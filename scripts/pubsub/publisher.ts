/**
 * Script to publish messages to a Pub/Sub topic
 *
 * The topicName defaults to `gcutils-scripts-topic` or `${PUBSUB_NAME}-topic`
 */
import { IJson } from 'jlog-facade';
import { createError } from '@fp8proj/core';
import { createPubSubService, topicName } from './common';

/**
 * Get payload from CLI
 *
 * @returns 
 */
function getPayload(): IJson {
    const input = process.argv[2];
    if (!input) {
        throw new Error('No input provided');
    }

    try {
        const json = JSON.parse(input);
        return json;
    } catch (err) {
        throw createError('Failed to parse input as JSON:', err);
    }
}

async function main() {
    const pubSubService = await createPubSubService();
    const payload = getPayload();

    const publisher = await pubSubService.createPublisher(topicName);
    await publisher.publishJson(payload);
    console.log(`Published message to topic ${topicName}:`, payload);
}

main().catch((error) => {
    console.error('Error occurred:', error);
    process.exit(1);
});

