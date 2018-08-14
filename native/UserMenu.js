import * as React from "react";
import { Button, Text, View } from "react-native";
import axios from "axios";
import config from "./config";
import icon from "./Icon";

export class UserMenu extends React.Component {

    authInterval;

    constructor(props) {
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

    componentDidUpdate(prevProps) {
        if (prevProps.user !== this.props.user) {
            if (this.props.user && this.props.user.spotifyUserId) {
                this.setState({
                    menuOptions: ["Logout"]
                });
            }
        }
    }

    selectMenuItem(e) {
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

    dropdownClicked(e) {
        e.preventDefault();
        this.setState((prevState) => ({
            dropdownVisible: !prevState.dropdownVisible
        }));
    }

    renderUserMenuOptions() {
        return this.state.menuOptions.map((option, i) => (
            <Text className={"dropdown-item"} key={"usermenu-" + i} id={option} onClick={this.selectMenuItem}>
                {this.optionToIcon(option)} {option}
            </Text>
        ));
    }

    hideMenu() {
        this.setState((prevState) => ({
            dropdownVisible: false
        }));
    }

    render() {
        return (
            <View>
                <Text onPress={this.dropdownClicked}>{icon.bars}</Text>
                <View className={"dropdown-menu " + (this.state.dropdownVisible ? "show" : "hide")} aria-labelledby="userMenuButton">
                    {this.renderUserMenuOptions()}
                </View>
                <View className={"menuOverlay " + (this.state.dropdownVisible ? "visible" : "hidden")} onPress={this.hideMenu}/>
            </View>
        );
    }

    logout() {
        axios.get(config.backend.url + "/logout")
        .then(resp => {
            window.location.replace("/");
        }).catch(err => {
            this.props.onError(err.response.data.message);
        });
    }

    loginWithSpotify() {
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

    isAuthorized() {
        axios.get(config.backend.url + "/user").then(response => {
            if (response.data.spotifyUserId) {
                clearInterval(this.authInterval);
                this.props.onSpotifyLogin();
            }
        }).catch(error => {
            this.props.onError(error.response.data.message);
        });
    }

    optionToIcon(share) {
        switch (share) {
            case "Logout":
                return (<Text style={{ fontFamily: "fas", fontSize: 20 }}>{icon["sign-out-alt"]}</Text>);
            case "Login with Spotify":
                return (<Text style={{ fontFamily: "fab", fontSize: 20 }}>{icon["spotify"]}</Text>);
            default:
                return (<Text style={{ fontFamily: "fas", fontSize: 20 }}>{icon["sign-out-alt"]}</Text>);
        }
    }
}

export default UserMenu;
