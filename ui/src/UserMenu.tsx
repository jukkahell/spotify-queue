import { IconProp } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import * as React from "react";
import axios from "../node_modules/axios";
import { IUser } from "./App";
import config from "./config";

export interface IUserMenuProps {
    onError: (msg: string) => void;
    onSpotifyLogin: () => void;
    updateUser: (username: string) => void;
    passcode: string;
    user: IUser;
}

export interface IUserMenuState {
    menuOptions: string[];
    selectedMenuItem: string | null;
    dropdownVisible: boolean;
    editUsername: boolean;
    username: string;
}

export class UserMenu extends React.Component<IUserMenuProps, IUserMenuState> {

    private authInterval: NodeJS.Timer;

    public constructor(props: IUserMenuProps) {
        super(props);

        this.state = {
            menuOptions: [
                "Logout",
                "Login with Spotify"
            ],
            selectedMenuItem: null,
            dropdownVisible: false,
            editUsername: false,
            username: props.user.username || props.user.spotifyUserId || props.user.id
        };

        this.selectMenuItem = this.selectMenuItem.bind(this);
        this.dropdownClicked = this.dropdownClicked.bind(this);
        this.logout = this.logout.bind(this);
        this.hideMenu = this.hideMenu.bind(this);
        this.isAuthorized = this.isAuthorized.bind(this);
        this.editUsername = this.editUsername.bind(this);
        this.updateUsername = this.updateUsername.bind(this);
        this.handleUsernameChange = this.handleUsernameChange.bind(this);
    }

    public selectMenuItem(e: React.MouseEvent<HTMLElement>) {
        switch (e.currentTarget.id) {
            case "Logout":
                this.logout();
                break;
            case "Login with Spotify":
                this.loginWithSpotify();
                break;
        }
        this.setState({
            dropdownVisible: false
        });
    }

    public dropdownClicked(e: React.MouseEvent<HTMLElement>) {
        e.preventDefault();
        this.setState((prevState) => ({
            dropdownVisible: !prevState.dropdownVisible
        }));
    }

    public editUsername() {
        this.setState({
            editUsername: true
        });
    }

    public handleUsernameChange(e: React.ChangeEvent<HTMLInputElement>) {
        e.preventDefault();
        this.setState({
            username: e.target.value
        });
    }

    public updateUsername(e: React.MouseEvent<HTMLElement>) {
        e.preventDefault();
        e.stopPropagation();

        if (!this.state.username || this.state.username.length === 0) {
            this.props.onError("Username cannot be empty.");
            return;
        } else if (this.state.username.length > 50) {
            this.props.onError("Username can't be longer than 50 characters.");
            return;
        }

        this.props.updateUser(this.state.username);
        this.setState({
            editUsername: false
        });
    }

    public renderUserMenuOptions() {
        const menu = [];
        menu.push(
            <div className="dropdown-item settingsMenuItem" key="username" id="username" onClick={this.editUsername}>
                <FontAwesomeIcon icon="user" />
                {this.state.editUsername ?
                    <form className="username">
                        <input type="text" value={this.state.username} onChange={this.handleUsernameChange} />
                        <button onClick={this.updateUsername}><FontAwesomeIcon icon="save" /></button>
                    </form> :
                    <span className="settingName">{this.state.username}</span>
                }
            </div>
        );
        menu.push(this.state.menuOptions.map((option: string, i: number) => (
            <a className={"dropdown-item"} key={"usermenu-" + i} href="#" id={option} onClick={this.selectMenuItem}>
                <FontAwesomeIcon icon={this.optionToIcon(option)} /> {option}
            </a>
        )));

        return menu;
    }

    public hideMenu() {
        this.setState(() => ({
            dropdownVisible: false
        }));
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
                    <FontAwesomeIcon icon="bars" />
                </button>
                <div className={"dropdown-menu " + (this.state.dropdownVisible ? "show" : "hide")} aria-labelledby="userMenuButton">
                    {this.renderUserMenuOptions()}
                </div>
                <div className={"menuOverlay " + (this.state.dropdownVisible ? "visible" : "hidden")} onClick={this.hideMenu}/>
            </div>
        );
    }

    private logout() {
      axios.get(config.backend.url + "/logout")
      .then(resp => {
          window.location.replace("/");
      }).catch(err => {
          this.props.onError(err.response.data.message);
      });
    }

    private loginWithSpotify() {
        const client_id = "da6ea27d63384e858d12bcce0fac006d";
        const visitorCallback = config.backend.url + "/visitorAuth";
        const url = "https://accounts.spotify.com/authorize" +
            "?client_id=" + client_id +
            "&response_type=code" +
            "&scope=playlist-read-private,playlist-read-collaborative" +
            "&redirect_uri=" + encodeURIComponent(visitorCallback);

        window.open(url, "SpotiQu", "WIDTH=400,HEIGHT=550");

        this.authInterval = setInterval(this.isAuthorized, 2000);
    }

    private isAuthorized() {
        axios.get(config.backend.url + "/user").then(response => {
            if (response.data.spotifyUserId) {
                clearInterval(this.authInterval);
                this.props.onSpotifyLogin();
            }
        }).catch(error => {
            this.props.onError(error.response.data.message);
        });
    }

    private optionToIcon(share: string): IconProp {
        switch (share) {
            case "Logout":
                return "sign-out-alt";
            case "Login with Spotify":
                return ["fab", "spotify"];
            default:
                return "sign-out-alt";
        }
    }
}

export default UserMenu;
