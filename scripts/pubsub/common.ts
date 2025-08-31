import { GCloudMetadata, PubSubService} from '@fp8proj';

const PUBSUB_NAME = process.env.PUBSUB_NAME;
export const topicName = getTopicName();
export const subscriptionName = getSubscriptionName();

export async function createPubSubService(): Promise<PubSubService> {
    const meta = new GCloudMetadata();
    await meta.initialize();
    const pubSubService = new PubSubService({
        projectId: meta.projectId
    });
    return pubSubService;
}

function getTopicName(): string {
    if (PUBSUB_NAME) {
        return `${PUBSUB_NAME}-topic`;
    } else {
        return 'gcutils-scripts-topic';
    }
}

function getSubscriptionName(): string {
    if (PUBSUB_NAME) {
        return `${PUBSUB_NAME}-sub`;
    } else {
        return 'gcutils-scripts-sub';
    }
}
