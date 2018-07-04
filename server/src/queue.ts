
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

    public toString() {
        return this.queue.map(uri => uri.split(':')[2]).join(',');
    }
}

export default Queue;