
class Queue {

    private queue: Array<string>;

    constructor() {
        this.queue = [];
    }

    public hasItems() {
        return this.queue.length > 0;
    }

    public push(item: string) {
        this.queue.push(item);
    }

    public shift() {
        return this.queue.shift();
    }

    public getUniqueIds() {
        let uniq = Array.from(new Set(this.queue));
        uniq = uniq.slice(0, Math.min(uniq.length, 50));
        return uniq.map(uri => uri.split(':')[2]).join(',');
    }

    public getQueue() {
        return this.queue;
    }
}

export default Queue;