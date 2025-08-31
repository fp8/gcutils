/**
 * Script to subscribe to a Pub/Sub subscription
 *
 * The topicName defaults to `gcutils-scripts-sub` or `${PUBSUB_NAME}-sub`
 */
import { delay, IJson } from 'jlog-facade';
import { createPubSubService, topicName, subscriptionName } from './common';
import { Message } from '@google-cloud/pubsub';

async function main() {
    const pubSubService = await createPubSubService();
    const topic = await pubSubService.createTopic(topicName);

    const subscriber = await pubSubService.createSubscriber(topic, subscriptionName);
    subscriber.listenJson(async (data: IJson, message: Message) => {
        console.log(`${message.id}:`, JSON.stringify(data));
    });

    console.log(`Listening for messages from ${subscriptionName} subscription.  CTRL-C to exit`);
    process.on('SIGINT', async () => {
        console.log("Deleting subscription and exit");
        await subscriber.delete();
        process.exit();
    });

    while (true) {
        await delay(1000);
    }
}

main().catch((error) => {
    console.error('Error occurred:', error);
    process.exit(1);
});
