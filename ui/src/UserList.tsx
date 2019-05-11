import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import axios from "axios";
import * as React from "react";
import { IUser } from "./App";
import config from "./config";

export interface IUserListProps {
    onError: (msg: string) => void;
    onEdit: () => void;
    isOwner: boolean;
    users: IUser[] | null;
}

export interface IUserListState {
    dropdownVisible: boolean;
    selectedUser: string | null;
}

export class UserList extends React.Component<IUserListProps, IUserListState> {

    public constructor(props: IUserListProps) {
        super(props);
        this.state = {
            dropdownVisible: false,
            selectedUser: null
        };

        this.dropdownClicked = this.dropdownClicked.bind(this);
        this.hideMenu = this.hideMenu.bind(this);
        this.selectUser = this.selectUser.bind(this);
        this.removeUser = this.removeUser.bind(this);
        this.resetUser = this.resetUser.bind(this);
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

    public selectUser(e: React.MouseEvent<HTMLElement>) {
        e.preventDefault();

        if (this.props.isOwner) {
            this.setState({
                selectedUser: e.currentTarget.id
            });
        }
    }

    public removeUser(e: React.MouseEvent<HTMLElement>) {
        e.preventDefault();

        if (window.confirm("Are you sure you want to remove this user?")) {
            axios.delete(config.backend.url + "/removeUser", {
                data: {
                    userId: e.currentTarget.id.split("remove-")[1]
                }
            }).then(() => {
                this.props.onEdit();
            }).catch(error => {
                this.props.onError(error.response.data.message);
            });
        }

        this.setState({
            selectedUser: null
        });
    }

    public resetUser(e: React.MouseEvent<HTMLElement>) {
        e.preventDefault();

        if (window.confirm("Are you sure you want to reset points for this user?")) {
            axios.put(config.backend.url + "/resetPoints", {
                userId: e.currentTarget.id.split("reset-")[1]
            }).then(() => {
                this.props.onEdit();
            }).catch(error => {
                this.props.onError(error.response.data.message);
            });
        }

        this.setState({
            selectedUser: null
        });
    }

    public renderUsers() {
        if (!this.props.users) {
            return null;
        }
        return this.props.users.map((user: IUser, i: number) => (
            <div className={"dropdown-item"} key={"user-" + i}>
                <div id={user.id} className={"userListItem " + (this.state.selectedUser === user.id ? "d-none" : "visible")} onClick={this.selectUser}>
                    <span className="userId">{user.username || user.spotifyUserId || user.id}</span>
                    <span className="points" title="karma">{user.karma} k</span>
                </div>
                <div className={"userListContextMenu " + (this.state.selectedUser === user.id ? "visible" : "d-none")}>
                    <a href="#" id={"remove-" + user.id} title="Remove from queue" onClick={this.removeUser}>
                        <FontAwesomeIcon icon="trash-alt" />
                    </a>
                    <a href="#" id={"reset-" + user.id} title="Reset points" onClick={this.resetUser}>
                        <FontAwesomeIcon icon="undo" />
                    </a>
                </div>
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
                    <FontAwesomeIcon icon="users" />
                </button>
                <div className={"dropdown-menu usersDropdown " + (this.state.dropdownVisible ? "show" : "hide")} aria-labelledby="userMenuButton">
                    {this.renderUsers()}
                </div>
                <div className={"menuOverlay " + (this.state.dropdownVisible ? "visible" : "hidden")} onClick={this.hideMenu}/>
            </div>
        );
    }
}

export default UserList;
