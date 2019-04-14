import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import * as React from "react";

export interface IUserQueue {
  name: string;
  passcode: string;
  owner: string;
}

export interface IQueueListProps {
  onError: (msg: string) => void;
  createQueue: (e: React.MouseEvent<HTMLElement>, passcode: string) => void;
  selectQueue: (passcode: string) => void;
  leaveQueue: () => void;
  removeQueue: () => void;
  queues: IUserQueue[];
  passcode: string;
  isOwner: boolean;
}

export interface IQueueListState {
  dropdownVisible: boolean;
  editJoinCode: boolean;
  joinCode: string;
}

export class QueueList extends React.Component<IQueueListProps, IQueueListState> {
  public constructor(props: IQueueListProps) {
    super(props);
    this.state = {
      dropdownVisible: false,
      editJoinCode: false,
      joinCode: "",
    };

    this.dropdownClicked = this.dropdownClicked.bind(this);
    this.hideMenu = this.hideMenu.bind(this);
    this.selectQueue = this.selectQueue.bind(this);
    this.editJoinCode = this.editJoinCode.bind(this);
    this.handleJoinCodeChange = this.handleJoinCodeChange.bind(this);
    this.joinQueue = this.joinQueue.bind(this);
    this.leaveQueue = this.leaveQueue.bind(this);
    this.removeQueue = this.removeQueue.bind(this);
  }

  public dropdownClicked(e: React.MouseEvent<HTMLElement>) {
    e.preventDefault();
    this.setState(prevState => ({
      dropdownVisible: !prevState.dropdownVisible,
    }));
  }

  public hideMenu() {
    this.setState(() => ({
      selectedUser: null,
      dropdownVisible: false,
      editJoinCode: false,
      joinCode: "",
    }));
  }

  public leaveQueue(e: React.MouseEvent<HTMLElement>) {
    e.preventDefault();

    if (window.confirm("Are you sure you want to leave this queue?")) {
      this.props.leaveQueue();
    }
  }

  public removeQueue(e: React.MouseEvent<HTMLElement>) {
    e.preventDefault();

    if (window.confirm("Are you sure you want to remove this queue? It will be permanent.")) {
      this.props.removeQueue();
    }
  }

  public editJoinCode() {
    this.setState(() => ({
      editJoinCode: true,
    }));
  }

  public handleJoinCodeChange(e: React.ChangeEvent<HTMLInputElement>) {
    e.preventDefault();
    this.setState({
      joinCode: e.target.value
    });
}

  public selectQueue(e: React.MouseEvent<HTMLElement>) {
    e.preventDefault();

    if (this.props.passcode === e.currentTarget.id) {
      return;
    }

    if (e.currentTarget.id === "createNew") {
      this.props.createQueue(e, "createNew");
    } else {
      this.props.selectQueue(e.currentTarget.id);
    }
  }

  public joinQueue(e: React.MouseEvent<HTMLElement>) {
    e.preventDefault();
    this.props.selectQueue(this.state.joinCode);
  }

  public renderQueues() {
    return this.props.queues.map((queue: IUserQueue, i: number) => (
      <div
        className={
          "dropdown-item userQueueListItem " + (this.props.passcode === queue.passcode ? "selected" : "")
        }
        id={queue.passcode}
        key={"queue-" + i}
        onClick={this.selectQueue}
      >
        {this.props.passcode === queue.passcode ? (
          <FontAwesomeIcon icon="clipboard-check" />
        ) : (
            <FontAwesomeIcon icon="clipboard-list" />
          )}
        <span className="queueName">{queue.name}</span>
      </div>
    ));
  }

  public render() {
    return (
      <div className="dropup">
        <button
          className="btn btn-secondary footerMenu"
          onClick={this.dropdownClicked}
          type="button"
          id="userMenuButton"
          data-toggle="dropdown"
          aria-haspopup="true"
          aria-expanded="false"
        >
          <FontAwesomeIcon icon="layer-group" />
        </button>
        <div
          className={"dropdown-menu queuesDropdown " + (this.state.dropdownVisible ? "show" : "hide")}
          aria-labelledby="queuesMenuButton"
        >
          {this.renderQueues()}
          <div className="dropdown-item settingsMenuItem" key="name" id="name" onClick={this.editJoinCode}>
            <FontAwesomeIcon icon="handshake" />
            {this.state.editJoinCode ?
                <form className="joinCode">
                    <input type="text" value={this.state.joinCode} onChange={this.handleJoinCodeChange} />
                    <button onClick={this.joinQueue}><FontAwesomeIcon icon="sign-in-alt" /></button>
                </form> :
                <span className="settingName">{this.state.joinCode || "Join another queue"}</span>
            }
          </div>
          <a className={"dropdown-item"} key="leaveQueue" href="#" id="leaveQueue" onClick={this.props.isOwner ? this.removeQueue : this.leaveQueue}>
            <FontAwesomeIcon icon="sign-out-alt" /> {this.props.isOwner ? "Remove this queue" : "Leave this queue"}
          </a>
        </div>
        <div
          className={"menuOverlay " + (this.state.dropdownVisible ? "visible" : "hidden")}
          onClick={this.hideMenu}
        />
      </div>
    );
  }
}

export default QueueList;
