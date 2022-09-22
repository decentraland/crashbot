import { IBaseComponent } from "@well-known-components/interfaces";
import { App } from '@slack/bolt';

export async function createBoltComponent(): Promise<IBaseComponent> {

  // Initializes your app with your bot token and signing secret
  const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    socketMode: true,
    appToken: process.env.SLACK_APP_TOKEN
  });

  // Listens to incoming command
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
                      text: "Minor issue"
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

  // Handle a view_submission request
  app.view('create', async ({ ack, body, view, client, logger }) => {
    // Acknowledge the view_submission request
    await ack();

    // Do whatever you want with the input data - here we're saving it to a DB then sending the user a verifcation of their submission
    console.log('body')
    console.log(body)
    console.log('view')
    console.log(view)
    const values = view['state']['values'];
    const severity = values['severity']
    const reportDate = values['report_date']
    const reportTime = values['report_time']
    const point = values['point']
    const contact = values['contact']
    const title = values['title']
    const description = values['description']
    console.log('severity')
    console.log(severity)
    console.log(severity['selected_option'])
    console.log('report date')
    console.log(reportDate)
    console.log('report time')
    console.log(reportTime)
    console.log('contact')
    console.log(contact)
    console.log('point')
    console.log(point)
    console.log('title')
    console.log(title)
    console.log('description')
    console.log(description)

    // Assume there's an input block with `block_1` as the block_id and `input_a`
    const user = body['user']['id'];

    // Message to send user
    let msg = 'Created succesfully with the following data:\n\n';
    msg += `*severity:* ${severity.severity.selected_option?.text.text}\n`
    msg += `*report date and time:* ${reportDate.report_date.selected_date}   ${reportTime.report_time.selected_time}hs\n`
    msg += `*point:* ${point.point.selected_user}\n`
    msg += `*contact:* ${contact.contact.selected_user}\n`
    msg += `*title:* ${title.title.value}\n`
    msg += `*description:* ${description.description.value}\n`
    
    // Save to DB
    // const results = await db.set(user.input, val);

    // if (results) {
    //   // DB save was successful
    //   msg = 'Your submission was successful';
    // } else {
    //   msg = 'There was an error with your submission';
    // }

    // Message the user
    try {
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

  async function stop() {

  }

  return {
    start,
    stop
  }
}