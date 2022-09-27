import { IBaseComponent } from "@well-known-components/interfaces";
import { App, PlainTextOption, ViewStateValue } from '@slack/bolt';
import { AppComponents } from "../types";
import SQL from "sql-template-strings";

export async function createBoltComponent(components: Pick<AppComponents, 'pg'>): Promise<IBaseComponent> {

  const { pg } = components

  // Initializes your app with your bot token and signing secret
  const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    socketMode: true,
    appToken: process.env.SLACK_APP_TOKEN
  });

  // Listens to create command
  app.command('/create', async ({ ack, body, client, logger }) => {
    // Acknowledge command request
    await ack();
  
    try {
      const now = new Date()
      console.log(now.getHours() + ':' + now.getMinutes())

      // Call views.open with the built-in client
      const result = await client.views.open({
        // Pass a valid trigger_id within 3 seconds of receiving it
        trigger_id: body.trigger_id,
        // View payload
        view: {
          type: 'modal',
          // View identifier
          callback_id: 'create',
          title: {
            type: 'plain_text',
            text: 'Create an incident'
          },
          blocks: [
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
                initial_option: {
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
                options: [
                  {
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
                  {
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
                  {
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
                  {
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
                  {
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
                ]
              }
            },
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
                initial_date: now.toISOString().split('T')[0],
                placeholder: {
                  type: "plain_text",
                  text: "Select a date"
                }
              }
            },
            {
              "type": "section",
              "block_id": "report_time",
              "text": {
                "type": "mrkdwn",
                "text": "Report time"
              },
              "accessory": {
                "type": "timepicker",
                "action_id": "report_time",
                "initial_time": now.toLocaleTimeString([], {
                    hourCycle: 'h23',
                    hour: '2-digit',
                    minute: '2-digit'
                }),
                "placeholder": {
                  "type": "plain_text",
                  "text": "Select a time"
                }
              }
            },
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
                }
              }
            },
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
                multiline: true
              }
            }
          ],
          submit: {
            type: 'plain_text',
            text: 'Create'
          }
        }
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
      
      // Assume there's an input block with `block_1` as the block_id and `input_a`
      const user = body['user']['id'];

      // Build reported_at
      const reportedAt = "'" + reportDate + " " + reportTime + ":00'"
      // const reportedAt = "'2022-09-26 10:18:00.000'"

      // Save to DB
      const queryResult = await pg.query(
        SQL`INSERT INTO incidents(
          update_number,
          severity,
          title,
          description,
          status,
          point,
          contact,
          reported_at,
          closed_at
        ) VALUES (
          0,
          ${severity},
          ${title},
          ${description},
          'open',
          ${point},
          ${contact},
          ${reportedAt},
          null
        )`
      )

      // Message to send user
      let msg = 'Incident created succesfully with the following data:\n\n';
      msg += `*severity:* ${severity}\n`
      msg += `*report date and time:* ${reportDate}   ${reportTime}hs\n`
      msg += `*point:* ${point}\n`
      msg += `*contact:* ${contact}\n`
      msg += `*title:* ${title}\n`
      msg += `*description:* ${description}\n`
      
      console.log('query results')
      console.log(queryResult)
      // if (results) {
      //   // DB save was successful
      //   msg = 'Your submission was successful';
      // } else {
      //   msg = 'There was an error with your submission';
      // }

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
      const queryResult = await pg.query<Incident>(
        SQL`SELECT 
              m.id,
              m.update_number,
              m.severity,
              m.title,
              m.description,
              m.status,
              m.point,
              m.contact,
              m.reported_at,
              m.closed_at
            FROM (
              SELECT id, MAX(update_number) AS last
              FROM incidents
              GROUP BY id
            ) t JOIN incidents m ON m.id = t.id AND t.last = m.update_number;
        `
      )
      console.log(queryResult)

      // Build options for the incidents menu
      const loadedIncidentsOptions: PlainTextOption[] = []
      queryResult.rows.forEach( (incident: Incident) => {
        loadedIncidentsOptions.push({
          text: {
            type: 'plain_text',
            text: (incident.status == 'closed' ? '✅ ' : '❌ ') + incident.title,
            emoji: true
          },
          value: incident.id.toString()
        })
      })

      // Call views.open with the built-in client
      const result = await client.views.open({
        // Pass a valid trigger_id within 3 seconds of receiving it
        trigger_id: body.trigger_id,
        // View payload
        view: {
          type: 'modal',
          // View identifier
          callback_id: 'update',
          title: {
            type: 'plain_text',
            text: 'Update an incident'
          },
          blocks: [
            {
              type: "input",
              element: {
                type: "static_select",
                options: await loadedIncidentsOptions
              },
              label: {
                type: "plain_text",
                text: "Select the incident"
            },
            }
          ],
          submit: {
            type: 'plain_text',
            text: 'Update'
          }
        }
      });
      logger.info(result);
    }
    catch (error) {
      logger.error(error);
    }
  });

  async function start() {
    await app.start(process.env.PORT || 3000); 
    console.log('⚡️ Bolt app is running!');
  }

  async function stop() {

  }

  return {
    start,
    stop
  }
}

type Severity = 'sev-1' | 'sev-2' | 'sev-3' | 'sev-4' | 'sev-5';
type Status = 'open' | 'closed';

type Incident = {
  id: number,
  update_number: number,
  severity: Severity,
  title: string,
  description: string,
  status: Status,
  point: string,
  contact: string,
  reported_at: Date,
  closed_at: Date
}
