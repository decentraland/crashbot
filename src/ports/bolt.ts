import { App, BlockAction, Datepicker, PlainTextInput, PlainTextOption, SectionBlock, StaticSelect, StaticSelectAction, Timepicker, UsersSelect, View } from '@slack/bolt';
import { AppComponents, BoltComponent, IncidentRow, IncidentViewOptions } from "../types";
import SQL from "sql-template-strings";
import { getUsername } from "../logic/slack";
import { getEmoji } from "../logic/incidents";

export async function createBoltComponent(components: Pick<AppComponents, 'pg' | 'config'>): Promise<BoltComponent> {

  const { pg, config } = components

  // Token needed to translate user ids to usernames
  const userToken = await config.getString('SLACK_USER_TOKEN') ?? ''

  // Initializes your app with your bot token and signing secret
  const app = new App({
    token: await config.getString('SLACK_BOT_TOKEN') ?? '',
    signingSecret: await config.getString('SLACK_SIGNING_SECRET') ?? '',
    socketMode: true,
    appToken: await config.getString('SLACK_APP_TOKEN') ?? ''
  });

  // Listens to create command
  app.command('/create', async ({ ack, body, client, logger }) => {
    // Acknowledge command request
    await ack();
  
    try {
      const now = new Date()

      // Call views.open with the built-in client
      const result = await client.views.open({
        // Pass a valid trigger_id within 3 seconds of receiving it
        trigger_id: body.trigger_id,
        // View payload
        view: getIncidentView({
          callbackId: 'create',
          modalTitle: 'Create an incident',
          severityOption: severitiesOptions['sev-1'] as PlainTextOption,
          point: '',
          contact: '',
          reportDate: now,
          title: '',
          description: '',
          submitButtonText: 'Create'
        })
      });
      logger.info(result);
    }
    catch (error) {
      logger.error(error);
    }
  });

  // Handle create view_submission request
  app.view('create', async ({ ack, body, view, client, logger }) => {
    // Acknowledge the view_submission request
    await ack();

    try {
      // Get data from modal
      const values = view['state']['values'];
      const severity = values['severity'].severity.selected_option?.value
      const reportDate = values['report_date'].report_date.selected_date
      const reportTime = values['report_time'].report_time.selected_time
      const point = values['point'].point.selected_user
      const contact = values['contact'].contact.selected_user
      const title = values['title'].title.value
      const description = values['description'].description.value
      
      const user = body['user']['id'];

      // Build reported_at
      const reportedAt = "'" + reportDate + " " + reportTime + ":00'"
      // const reportedAt = "'2022-09-26 10:18:00.000'"

      // Save to DB
      const queryResult = await pg.query(
        SQL`INSERT INTO incidents(
          update_number,
          modified_by,
          severity,
          title,
          description,
          status,
          point,
          contact,
          reported_at
        ) VALUES (
          0,
          ${user},
          ${severity},
          ${title},
          ${description},
          'open',
          ${point},
          ${contact},
          ${reportedAt}
        )`
      )

      // Message to send user
      let msg = 'Incident created succesfully with the following data:\n\n';
      msg += `*Severity:* ${severity}\n`
      msg += `*Report date and time:* ${reportDate}   ${reportTime}hs\n`
      msg += `*Point:* ${await getUsername(app, userToken, point)}\n`
      msg += `*Contact:* ${await getUsername(app, userToken, contact)}\n`
      msg += `*Title:* ${title}\n`
      msg += `*Description:* ${description}\n`

      // Message the user    
      await client.chat.postMessage({
        channel: user,
        text: msg
      });
    }
    catch (error) {
      logger.error(error);
    }

  });

  app.command('/update', async ({ ack, body, client, logger }) => {
    // Acknowledge command request
    await ack();
  
    try {
      // Get all incidents
      const queryResult = await pg.query<IncidentRow>(
        SQL`SELECT 
              m.id,
              m.update_number,
              m.reported_at,
              m.closed_at,
              m.status, 
              m.severity,
              m.title,
              m.description,
              m.point,
              m.contact,
              m.rca_link
            FROM (
              SELECT id, MAX(update_number) AS last
              FROM incidents
              GROUP BY id
            ) t JOIN incidents m ON m.id = t.id AND t.last = m.update_number;
        `
      )

      // Build options for the incidents menu
      const loadedIncidentsOptions: PlainTextOption[] = []
      queryResult.rows.forEach( (incident: IncidentRow) => {
        loadedIncidentsOptions.push({
          text: {
            type: 'plain_text',
            text: `${getEmoji(incident)} DCL-${incident.id} ${incident.title}`,
            emoji: true
          },
          value: incident.id.toString()
        })
      })

      if (queryResult.rowCount > 0) {
        await client.views.open({
          trigger_id: body.trigger_id,
          view: {
            type: 'modal',
            callback_id: 'update',
            title: {
              type: 'plain_text',
              text: 'Update an incident'
            },
            blocks: [
              {
                type: "actions",
                block_id: 'loaded_incidents',
                elements: [
                  {
                    action_id: 'loaded_incidents',
                    type: "static_select",
                    options: loadedIncidentsOptions
                  }
                ]
              }
            ],
            submit: {
              type: 'plain_text',
              text: 'Update'
            },
            private_metadata: JSON.stringify({ incidents: queryResult.rows })
          }
        });
      } else {
        // Message the user
        await client.chat.postMessage({
          channel: body.user_id,
          text: 'There are no incidents! Create one using `/create`'
        });
      }
    }
    catch (error) {
      logger.error(error);
    }
  });

  app.action('loaded_incidents', async ({ ack, body, logger, client }) => {
    await ack();

    try {
      // Get data from body
      const blockActionBody = body as BlockAction
      const previousView = blockActionBody.view
      const action = blockActionBody.actions[0] as StaticSelectAction;
      const selectIncidentId = action.selected_option.value

      const queryResult = await pg.query<IncidentRow>(
        SQL`SELECT * FROM incidents WHERE id = ${selectIncidentId} ORDER BY update_number DESC LIMIT 1;`
      )
  
      // Build the new view
      const incident = queryResult.rows[0]
      const newView = getIncidentView({
        callbackId: 'update',
        modalTitle: 'Update an incident',
        severityOption: severitiesOptions[incident.severity] as PlainTextOption,
        reportDate: incident.reported_at,
        resolutionDate: incident.closed_at,
        point: incident.point,
        contact: incident.contact,
        title: incident.title,
        description: incident.description,
        submitButtonText: 'Update',
        status: incident.status,
        rcaLink: incident.rca_link
      });

      // Parse metadata
      const metadata = JSON.parse(previousView?.private_metadata ?? '{}')
      
      // Add the selected incdent's id to the metadata
      metadata.selected_incident_id = selectIncidentId
      
      // Pass the data about all the incidents
      newView.private_metadata = JSON.stringify(metadata)
      
      // Call views.update with the built-in client
      const result = await client.views.update({
        view_id: previousView?.id,
        hash: previousView?.hash,
        view: newView
      });
      logger.info(result);
    }
    catch (error) {
      logger.error(error);
    }
  });

  // Handle update view_submission request
  app.view('update', async ({ ack, body, view, client, logger }) => {
    // Acknowledge the view_submission request
    await ack();

    try {
      // Get data from modal
      const values = view['state']['values'];
      const severity = values['severity'].severity.selected_option
      const reportDate = values['report_date'].report_date.selected_date
      const reportTime = values['report_time'].report_time.selected_time
      const resolutionDate = values['resolution_date'].resolution_date.selected_date
      const resolutionTime = values['resolution_time'].resolution_time.selected_time
      const point = values['point'].point.selected_user
      const contact = values['contact'].contact.selected_user
      const title = values['title'].title.value
      const description = values['description'].description.value
      const status = values['status'].status.selected_option
      const rcaLink = values['rca_link'].rca_link.value

      // Get metadata from modal
      const metadata = JSON.parse(view.private_metadata)
      const allIncidents = metadata.incidents as IncidentRow[]
      const selectedIncident = allIncidents.filter( incident => (incident.id == metadata.selected_incident_id))[0]

      const user = body['user']['id'];

      // Build dates
      const reportedAt = "'" + reportDate + " " + reportTime + ":00'"
      const closedAt = (resolutionDate && resolutionTime) ? "'" + resolutionDate + " " + resolutionTime + ":00'" : null

      // Save to DB
      const queryResult = await pg.query(
        SQL`INSERT INTO incidents(
          id,
          update_number,
          modified_by,
          severity,
          title,
          description,
          status,
          point,
          contact,
          reported_at,
          closed_at,
          rca_link
        ) VALUES (
          ${selectedIncident.id},
          ${selectedIncident.update_number + 1},
          ${user},
          ${severity?.value},
          ${title},
          ${description},
          ${status?.value},
          ${point},
          ${contact},
          ${reportedAt},
          ${closedAt},
          ${rcaLink}
        )`
      )

      // Build message to send to user
      let msg = 'Incident updated succesfully with the following data:\n\n';
      msg += `*Severity:* ${severity?.text.text}\n`
      msg += `*Report date and time:* ${reportDate}  ${reportTime}hs\n`

      if (closedAt)
        msg += `*Resolution date and time:* ${resolutionDate}  ${resolutionTime}hs\n`
      
      msg += `*Point:* ${await getUsername(app, userToken, point)}\n`
      msg += `*Contact:* ${await getUsername(app, userToken, contact)}\n`
      msg += `*Title:* ${title}\n`
      msg += `*Description:* ${description}\n`
      msg += `*Status:* ${status?.text.text}\n`

      if (rcaLink)
        msg += `*RCA link:* ${rcaLink}`

      // Message the user    
      await client.chat.postMessage({
        channel: user,
        text: msg
      });
    }
    catch (error) {
      logger.error(error);
    }

  });

  async function start() {
    await app.start(process.env.PORT || 3000); 
    console.log('⚡️ Bolt app is running!');
  }

  async function stop() {}

  return {
    start,
    stop,
    app
  }
}



const severitiesOptions = {
  'sev-1': {
    text: {
      type: "plain_text",
      text: "SEV-1"
    },
    value: "sev-1",
    description: {
      type: "plain_text",
      text: "Critical, impacting 50% of users"
    }
  },
  'sev-2': {
    text: {
      type: "plain_text",
      text: "SEV-2"
    },
    value: "sev-2",
    description: {
      type: "plain_text",
      text: "Critical, impacting some users"
    }
  },
  'sev-3': {
    text: {
      type: "plain_text",
      text: "SEV-3"
    },
    value: "sev-3",
    description: {
      type: "plain_text",
      text: "Stability or minor user impact"
    }
  },
  'sev-4': {
    text: {
      type: "plain_text",
      text: "SEV-4"
    },
    value: "sev-4",
    description: {
      type: "plain_text",
      text: "Minor issue"
    }
  },
  'sev-5': {
    text: {
      type: "plain_text",
      text: "SEV-5"
    },
    value: "sev-5",
    description: {
      type: "plain_text",
      text: "Cosmetics issues or bugs"
    }
  }
}

const statusOptions = {
  'open': {
    text: {
      type: "plain_text",
      text: "Open 🚨",
      emoji: true
    },
    value: "open"
  },
  'closed': {
    text: {
      type: "plain_text",
      text: "Closed ✅",
      emoji: true
    },
    value: "closed"
  },
  'invalid': {
    text: {
      type: "plain_text",
      text: "Invalid 🚫",
      emoji: true
    },
    value: "invalid"
  }
}

function getIncidentView(options: IncidentViewOptions): View {
  const view = {
    type: 'modal',
    // View identifier
    callback_id: options.callbackId,
    title: {
      type: 'plain_text',
      text: options.modalTitle
    },
    blocks: [
      // Severity
      {
        type: "section",
        block_id: "severity",
        text: {
          type: "mrkdwn",
          text: "Severity"
        },
        accessory: {
          action_id: "severity",
          type: "static_select",
          initial_option: options.severityOption,
          options: Object.values(severitiesOptions) as PlainTextOption[]
        }
      },
      // Report date
      {
        type: "section",
        block_id: "report_date",
        text: {
          type: "mrkdwn",
          text: "Report date"
        },
        accessory: {
          type: "datepicker",
          action_id: "report_date",
          initial_date: options.reportDate.toISOString().split('T')[0],
          placeholder: {
            type: "plain_text",
            text: "Select a date"
          }
        }
      },
      // Report time
      {
        type: "section",
        block_id: "report_time",
        text: {
          type: "mrkdwn",
          text: "Report time"
        },
        accessory: {
          type: "timepicker",
          action_id: "report_time",
          initial_time: options.reportDate.toLocaleTimeString([], {
           hourCycle: 'h23',
           hour: '2-digit',
           minute: '2-digit'
          }),
          placeholder: {
            type: "plain_text",
            text: "Select a time"
          }
        }
      },
      // Point
      {
        type: "section",
        block_id: "point",
        text: {
          type: "mrkdwn",
          text: "Point"
        },
        accessory: {
          action_id: "point",
          type: "users_select",
          placeholder: {
            type: "plain_text",
            text: "Select user as point"
          }
        }
      },
      // Contact
      {
        type: "section",
        block_id: "contact",
        text: {
          type: "mrkdwn",
          text: "Contact"
        },
        accessory: {
          action_id: "contact",
          type: "users_select",
          placeholder: {
            type: "plain_text",
            text: "Select user as contact"
          }
        }
      },
      // Title
      {
        type: "input",
        block_id: "title",
        label: {
          type: "plain_text",
          text: "Title"
        },
        element: {
          type: "plain_text_input",
          action_id: "title",
          placeholder: {
            type: "plain_text",
            text: "Summary of the incident"
          },
          initial_value: options.title
        }
      },
      // Description
      {
        type: "input",
        block_id: "description",
        label: {
          type: "plain_text",
          text: "Description"
        },
        element: {
          type: "plain_text_input",
          action_id: "description",
          placeholder: {
            type: "plain_text",
            text: "Describe the incident and steps to reproduce"
          },
          multiline: true,
          initial_value: options.description
        }
      }
    ],
    submit: {
      type: 'plain_text',
      text: options.submitButtonText
    }
  } as View

  // Add point if not null
  if (options.point) {
    ((view.blocks[3] as SectionBlock).accessory as UsersSelect).initial_user = options.point
  }

  // Add contact if not null
  if (options.contact) {
    ((view.blocks[4] as SectionBlock).accessory as UsersSelect).initial_user = options.contact
  }

  // Add fields when updating
  if (options.callbackId == 'update') {
    // Closed date
    const resolutionDateBlock = {
      type: "section",
      block_id: "resolution_date",
      text: {
        type: "mrkdwn",
        text: "Resolution date"
      },
      accessory: {
        type: "datepicker",
        action_id: "resolution_date",
        placeholder: {
          type: "plain_text",
          text: "Select a date"
        }
      } as Datepicker
    }

    // Closed time
    const resolutionTimeBlock = {
      type: "section",
      block_id: "resolution_time",
      text: {
        type: "mrkdwn",
        text: "Resolution time"
      },
      accessory: {
        type: "timepicker",
        action_id: "resolution_time",
        placeholder: {
          type: "plain_text",
          text: "Select a time"
        }
      } as Timepicker
    }

    if (options.resolutionDate) {
      // Initialize select menu with resolution date data
      resolutionDateBlock.accessory.initial_date = options.resolutionDate.toISOString().split('T')[0]

      // Initialize select menu with resolution time data
      resolutionTimeBlock.accessory.initial_time = options.resolutionDate.toLocaleTimeString([], {
        hourCycle: 'h23',
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    // Add resolution date and time blocks to view (after report date and time)
    view.blocks.splice(3, 0, resolutionDateBlock, resolutionTimeBlock)
  
    // Status
    const statusBlock = {
      type: "section",
      block_id: "status",
      text: {
        type: "mrkdwn",
        text: "Status"
      },
      accessory: {
        action_id: "status",
        type: "static_select",
        options: Object.values(statusOptions) as PlainTextOption[]
      } as StaticSelect
    }

    // Initialize select menu with status data
    if (options.status)
      statusBlock.accessory.initial_option = statusOptions[options.status] as PlainTextOption

    // Add status block to view
    view.blocks.push(statusBlock)

    // RCA Link
    const rcaLinkBlock = {
      type: "input",
      block_id: "rca_link",
      label: {
        type: "plain_text",
        text: "RCA Link"
      },
      element: {
        type: "plain_text_input",
        action_id: "rca_link",
        placeholder: {
          type: "plain_text",
          text: "Paste a link to the RCA"
        }
      } as PlainTextInput,
      optional: true
    }

    // Initialize RCA Link input with previous data
    if(options.rcaLink)
      rcaLinkBlock.element.initial_value = options.rcaLink

    // Add RCA Link block to view
    view.blocks.push(rcaLinkBlock)
  }
  view.private_metadata

  return view
}
