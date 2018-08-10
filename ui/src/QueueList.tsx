import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import * as React from "react";

export interface IUserQueue {
    name: string;
    passcode: string;
}

export interface IQueueListProps {
    onError: (msg: string) => void;
    selectQueue: (passcode: string) => void;
    queues: IUserQueue[] | null;
    passcode: string;
}

export interface IQueueListState {
    dropdownVisible: boolean;
}

export class QueueList extends React.Component<IQueueListProps, IQueueListState> {

    public constructor(props: IQueueListProps) {
        super(props);
        this.state = {
            dropdownVisible: false
        };

        this.dropdownClicked = this.dropdownClicked.bind(this);
        this.hideMenu = this.hideMenu.bind(this);
        this.selectQueue = this.selectQueue.bind(this);
    }

    public dropdownClicked(e: React.MouseEvent<HTMLElement>) {
        e.preventDefault();
        this.setState((prevState) => ({
            dropdownVisible: !prevState.dropdownVisible
        }));
    }

    public hideMenu() {
        this.setState(() => ({
            selectedUser: null,
            dropdownVisible: false
        }));
    }

    public selectQueue(e: React.MouseEvent<HTMLElement>) {
        e.preventDefault();

        if (this.props.passcode === e.currentTarget.id) {
            return;
        }

        this.props.selectQueue(e.currentTarget.id);
    }

    public renderQueues() {
        if (!this.props.queues) {
            return null;
        }
        return this.props.queues.map((queue: IUserQueue, i: number) => (
            <div className={"dropdown-item userQueueListItem " + (this.props.passcode === queue.passcode ? "selected" : "")}
                id={queue.passcode}
                key={"queue-" + i}
                onClick={this.selectQueue}>
                {this.props.passcode === queue.passcode
                    ? <FontAwesomeIcon icon="clipboard-check" />
                    : <FontAwesomeIcon icon="clipboard-list" />
                }
                <span className="queueName">{queue.name}</span>
            </div>
        ));
    }

    public render() {
        return (
            <div className="dropup">
                <button className="btn btn-secondary footerMenu"
                        onClick={this.dropdownClicked}
                        type="button"
                        id="userMenuButton"
                        data-toggle="dropdown"
                        aria-haspopup="true"
                        aria-expanded="false">
                    <FontAwesomeIcon icon="layer-group" />
                </button>
                <div className={"dropdown-menu queuesDropdown " + (this.state.dropdownVisible ? "show" : "hide")} aria-labelledby="queuesMenuButton">
                    {this.renderQueues()}
                </div>
                <div className={"menuOverlay " + (this.state.dropdownVisible ? "visible" : "hidden")} onClick={this.hideMenu}/>
            </div>
        );
    }
}

export default QueueList;
