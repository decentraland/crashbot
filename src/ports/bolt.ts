import { App, BlockAction, Datepicker, InputBlock, PlainTextInput, PlainTextOption, SectionBlock, StaticSelect, StaticSelectAction, Timepicker, UsersSelect, View } from '@slack/bolt';
import { AppComponents, BoltComponent, IncidentRow, IncidentViewOptions } from "../types";
import { compareByDate, compareBySeverity, getEmoji } from "../logic/incidents";
import { getusername, updateChannelTopic } from '../logic/slack';
import { CREATE_INCIDENT, GET_LAST_UPDATE_OF_ALL_INCIDENTS_FEW_COLUMNS, GET_LAST_UPDATE_OF_SELECTED_INCIDENT, UPDATE_INCIDENT } from '../queries';

export async function createBoltComponent(components: Pick<AppComponents, 'pg' | 'config' | 'logs'>): Promise<BoltComponent> {

  const { pg, config } = components

  const userToken = await config.getString('SLACK_USER_TOKEN') ?? ''
  const botToken = await config.getString('SLACK_BOT_TOKEN') ?? ''

  // Initialize app
  const app = new App({
    token: botToken,
    signingSecret: await config.getString('SLACK_SIGNING_SECRET') ?? '',
    socketMode: true,
    appToken: await config.getString('SLACK_APP_TOKEN') ?? ''
  });

  // Commands are retrieved from environment for local testing
  const createCommand = await config.getString('CREATE_COMMAND') ?? '/create-incident';
  const updateCommand = await config.getString('UPDATE_COMMAND') ?? '/update-incident';

  // Listens to create command
  app.command(createCommand, async ({ ack, body, client, logger }) => {
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
      const reportDateTimeObj = values['report_date_time'].report_date_time as { type: string, selected_date_time: number } 
      const reportTimestamp = reportDateTimeObj.selected_date_time * 1000
      const point = values['point'].point.selected_user
      const contact = values['contact'].contact.selected_user
      const title = values['title'].title.value
      const description = values['description'].description.value
      
      const user = body['user']['id'];

      // Build report date
      const reportedAt = buildDateAndTime(reportTimestamp)

      // Save to DB
      const queryResult = await pg.query(CREATE_INCIDENT(user, severity, title, description, point, contact, reportedAt))
      
      // Message to send user
      const addedIncident = queryResult.rows[0] as { id: string };
      let msg = 'Incident created succesfully with the following data:\n\n';
      msg += `*Id:* DCL-${addedIncident.id}\n`
      msg += `*Severity:* ${severity}\n`
      msg += `*Report date and time:* ${reportedAt}hs\n`
      msg += `*Point:* ${getusername(point)}\n`
      msg += `*Contact:* ${getusername(contact)}\n`
      msg += `*Title:* ${title}\n`
      msg += `*Description:* ${description}\n`

      // Message the #crash channel
      await client.chat.postMessage({
        channel: 'crash',
        text: msg
      });

      // Message the user    
      await client.chat.postMessage({
        channel: user,
        text: msg
      });

      // Update channel topic
      updateChannelTopic({ ...components, bolt })
    }
    catch (error) {
      logger.error(error);
    }

  });

  // Listens to update command
  app.command(updateCommand, async ({ ack, body, client, logger }) => {
    // Acknowledge command request
    await ack();
  
    try {
      // Get all incidents
      const queryResult = await pg.query<IncidentRow>(GET_LAST_UPDATE_OF_ALL_INCIDENTS_FEW_COLUMNS)

      // Separate between open, closed and invalid
      const open: IncidentRow[] = []
      const closed: IncidentRow[] = []
      const invalid: IncidentRow[] = []
      queryResult.rows.forEach( (incident: IncidentRow) => {
        if (incident.status === "open")
        open.push(incident)
        else if (incident.status === "closed")
        closed.push(incident)
        else
          invalid.push(incident)
      })
  
      // Sort them individually
      open.sort(compareBySeverity)
      closed.sort(compareByDate)
      invalid.sort(compareByDate)

      // Build options for the incidents menu
      const loadedIncidentsOptions: PlainTextOption[] = []
      open.concat(closed).concat(invalid).forEach( (incident: IncidentRow) => {
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
            }
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
      const selectedIncidentId = action.selected_option.value

      // Get last update for selected incident
      const queryResult = await pg.query<IncidentRow>(GET_LAST_UPDATE_OF_SELECTED_INCIDENT(selectedIncidentId))
  
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

      // Add selected incident to metadata
      const metadata = { selectedIncident: incident }

      // Pass the data about all the incidents
      newView.private_metadata = JSON.stringify(metadata)
      
      // Update the modal
      await client.views.update({
        view_id: previousView?.id,
        hash: previousView?.hash,
        view: newView
      });
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
      const reportDateTimeObj = values['report_date_time'].report_date_time as { type: string, selected_date_time: number } 
      const reportTimestamp = reportDateTimeObj.selected_date_time * 1000
      const resolutionDateTimeObj = values['resolution_date_time'].resolution_date_time as { type: string, selected_date_time: number } 
      let resolutionTimestamp = resolutionDateTimeObj.selected_date_time * 1000
      const point = values['point'].point.selected_user
      const contact = values['contact'].contact.selected_user
      const title = values['title'].title.value
      const description = values['description'].description.value
      const status = values['status'].status.selected_option
      const rcaLink = values['rca_link'].rca_link.value

      // Get metadata from modal
      const metadata = JSON.parse(view.private_metadata)
      const selectedIncident = metadata.selectedIncident as IncidentRow

      const user = body['user']['id'];

      // Build report date
      const reportedAt = buildDateAndTime(reportTimestamp)

      // Build closed date. Use now as default closed date if the incident is being closed without a date
      let closedAt
      if (status?.value === "closed" && !resolutionTimestamp)
        resolutionTimestamp = new Date().getTime()
      
      closedAt = buildDateAndTime(resolutionTimestamp)

      // Save to DB
      await pg.query(
        UPDATE_INCIDENT(
          selectedIncident.id,
          selectedIncident.update_number + 1,
          user,
          severity?.value,
          title,
          description,
          point,
          contact,
          reportedAt,
          status?.value,
          closedAt,
          rcaLink
        )
      )

      // Build message to send to user
      let msg = 'Incident updated succesfully with the following data:\n\n';
      msg += `*Id:* DCL-${selectedIncident.id}\n`
      msg += `*Severity:* ${severity?.text.text}\n`
      msg += `*Report date and time:* ${reportedAt}hs\n`

      if (closedAt)
        msg += `*Resolution date and time:* ${closedAt}hs\n`
      
      msg += `*Point:* ${getusername(point)}\n`
      msg += `*Contact:* ${getusername(contact)}\n`
      msg += `*Title:* ${title}\n`
      msg += `*Description:* ${description}\n`
      msg += `*Status:* ${status?.text.text}\n`

      if (rcaLink)
        msg += `*RCA link:* ${rcaLink}`

      // Message the #crash channel
      await client.chat.postMessage({
        channel: 'crash',
        text: msg
      });

      // Message the user
      await client.chat.postMessage({
        channel: user,
        text: msg
      });

      // Update channel topic
      updateChannelTopic({ ...components, bolt })
    }
    catch (error) {
      logger.error(error);
    }

  });

  // Route the action_id of every input to a dummy handler that does nothing to avoid getting a warning signal on each of them
  app.action('severity', ({ ack }) => ack())
  app.action('report_date', ({ ack }) => ack())
  app.action('report_time', ({ ack }) => ack())
  app.action('point', ({ ack }) => ack())
  app.action('contact', ({ ack }) => ack())
  app.action('resolution_date', ({ ack }) => ack())
  app.action('resolution_time', ({ ack }) => ack())
  app.action('status', ({ ack }) => ack())

  async function start() {
    await app.start(process.env.PORT || 3000);
    console.log('⚡️ Bolt app is running!');
  }

  async function stop() {
    await app.stop()
    console.log('⚡️ Bolt app has stopped!')
  }

  async function getProfile(userId: string) {
    return app.client.users.profile.get({
      user: userId,
      token: userToken
    })
  }

  async function setTopic(channelId: string, topic: string) {
    await app.client.conversations.setTopic({
      token: botToken,
      channel: channelId,
      topic: topic
    })
  }

  const bolt = {
    start,
    stop,
    getProfile,
    setTopic
  }

  return bolt
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
      text: "Cosmetics issue"
    }
  }
}

const statusOptions = {
  'open': {
    text: {
      type: "plain_text",
      text: "🚨 Open",
      emoji: true
    },
    value: "open"
  },
  'closed': {
    text: {
      type: "plain_text",
      text: "✅ Closed",
      emoji: true
    },
    value: "closed"
  },
  'invalid': {
    text: {
      type: "plain_text",
      text: "🚫 Invalid",
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
      // Report date & time
      {
        type: "input",
        block_id: "report_date_time",
        element: {
          type: "datetimepicker",
          action_id: "report_date_time",
          initial_date_time: Math.floor(new Date(options.reportDate).getTime() / 1000)
        },
        label: {
          type: "plain_text",
          "text": "Report date & time"
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
          initial_value: options.title,
          max_length: 65
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
          initial_value: options.description,
          max_length: 2000
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
    // Resolution date & time
    const resolutionDateTimeBlock = {
      type: "input",
      block_id: "resolution_date_time",
      element: {
        type: "datetimepicker",
        action_id: "resolution_date_time",
        initial_date_time: 0
      },
			label: {
				type: "plain_text",
				"text": "Resolution date & time"
			},
      optional: true
    }

    // Set resolution date if it exists
    if (options.resolutionDate)
      resolutionDateTimeBlock.element.initial_date_time = Math.floor(new Date(options.resolutionDate).getTime() / 1000)
    
    // Add resolution date & time block to view (after report date & time)
    view.blocks.splice(3, 0, resolutionDateTimeBlock)
  
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

    if (options.status) {
      // Initialize select menu with status data
      statusBlock.accessory.initial_option = statusOptions[options.status] as PlainTextOption

      // Make resolution date & time mandatory if incident is closed
      if (options.status === "closed")  
        resolutionDateTimeBlock.optional = false
    }

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
        },
        max_length: 75
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

function buildDateAndTime(timestamp: number | null | undefined) {
  if (timestamp) {
    const date = new Date(timestamp).toISOString().split('T')[0]
    const options = {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    } as Intl.DateTimeFormatOptions
    const time = new Intl.DateTimeFormat('default', options).format(new Date(timestamp))
    return "" + date + " " + time + ":00"
  }
  return null
}
