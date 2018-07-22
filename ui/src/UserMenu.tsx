import { IconProp } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import * as React from "react";
import axios from "../node_modules/axios";
import { IUser } from "./App";
import config from "./config";

export interface IUserMenuProps {
    onError: (msg: string) => void;
    onSpotifyLogin: () => void;
    passcode: string;
    user: IUser | null;
}

export interface IUserMenuState {
    menuOptions: string[];
    selectedMenuItem: string | null;
    dropdownVisible: boolean;
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
            dropdownVisible: false
        };

        this.selectMenuItem = this.selectMenuItem.bind(this);
        this.dropdownClicked = this.dropdownClicked.bind(this);
        this.logout = this.logout.bind(this);
        this.hideMenu = this.hideMenu.bind(this);
        this.isAuthorized = this.isAuthorized.bind(this);
    }

    public componentDidUpdate(prevProps: IUserMenuProps) {
        if (prevProps.user !== this.props.user) {
            if (this.props.user && this.props.user.spotifyUserId) {
                this.setState({
                    menuOptions: ["Logout"]
                });
            }
        }
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

    public renderUserMenuOptions() {
        return this.state.menuOptions.map((option: string, i: number) => (
            <a className={"dropdown-item"} key={"usermenu-" + i} href="#" id={option} onClick={this.selectMenuItem}>
                <FontAwesomeIcon icon={this.optionToIcon(option)} /> {option}
            </a>
        ));
    }

    public hideMenu() {
        this.setState((prevState) => ({
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
