import icon from "./Icon";
import * as React from "react";
import { View, Button, Text } from "react-native";
import NumberSetting from "./NumberSetting";

export class Settings extends React.Component {

    constructor(props) {
        super(props);

        this.state = {
            dropdownVisible: false,
            editName: false,
            name: props.settings.name
        };

        this.toggleGamify = this.toggleGamify.bind(this);
        this.toggleRandomPlaylist = this.toggleRandomPlaylist.bind(this);
        this.toggleRandomQueue = this.toggleRandomQueue.bind(this);
        this.dropdownClicked = this.dropdownClicked.bind(this);
        this.hideMenu = this.hideMenu.bind(this);
        this.updateSkipThreshold = this.updateSkipThreshold.bind(this);
        this.updateDuplicates = this.updateDuplicates.bind(this);
        this.updateSequential = this.updateSequential.bind(this);
        this.toggleSpotifyLogin = this.toggleSpotifyLogin.bind(this);
        this.editName = this.editName.bind(this);
        this.updateName = this.updateName.bind(this);
        this.handleNameChange = this.handleNameChange.bind(this);
    }

    toggleGamify(e) {
        e.preventDefault();
        const settings = this.props.settings;
        settings.gamify = !settings.gamify;
        this.props.updateSettings(settings);
    }

    toggleRandomPlaylist(e) {
        e.preventDefault();
        const settings = this.props.settings;
        settings.randomPlaylist = !settings.randomPlaylist;
        this.props.updateSettings(settings);
    }

    toggleRandomQueue(e) {
        e.preventDefault();
        const settings = this.props.settings;
        settings.randomQueue = !settings.randomQueue;
        this.props.updateSettings(settings);
    }

    toggleSpotifyLogin(e) {
        e.preventDefault();
        const settings = this.props.settings;
        settings.spotifyLogin = !settings.spotifyLogin;
        this.props.updateSettings(settings);
    }

    dropdownClicked(e) {
        e.preventDefault();

        this.setState((prevState) => ({
            dropdownVisible: !prevState.dropdownVisible
        }));
    }

    updateSkipThreshold(value) {
        this.props.settings.skipThreshold = value;
        this.props.updateSettings(this.props.settings);
    }

    updateDuplicates(value) {
        this.props.settings.maxDuplicateTracks = value;
        this.props.updateSettings(this.props.settings);
    }

    updateSequential(value) {
        this.props.settings.maxSequentialTracks = value;
        this.props.updateSettings(this.props.settings);
    }

    editName() {
        this.setState({
            editName: true
        });
    }

    handleNameChange(e) {
        e.preventDefault();
        this.setState({
            name: e.target.value
        });
    }

    updateName(e) {
        e.preventDefault();
        e.stopPropagation();

        if (!this.state.name || this.state.name.length === 0) {
            this.props.onError("Name cannot be empty.");
            return;
        } else if (this.state.name.length > 50) {
            this.props.onError("Name can't be longer than 50 characters.");
            return;
        }

        const settings = this.props.settings;
        settings.name = this.state.name;
        this.props.updateSettings(settings, ["name"]);

        this.setState({
            editName: false
        });
    }

    renderSettingsOptions() {
        return ([
            <a className="dropdown-item settingsMenuItem" key="name" href="#" id="name" onClick={this.editName}>
                <Text style={{ fontFamily: "fas", fontSize: 20 }}>{icon["edit"]}</Text>
                {this.state.editName ?
                    <form className="queueName">
                        <input type="text" value={this.state.name} onChange={this.handleNameChange} />
                        <button onClick={this.updateName}><Text style={{ fontFamily: "fas", fontSize: 20 }}>{icon["save"]}</Text></button>
                    </form> :
                    <span className="settingName">{this.state.name || "Queue name"}</span>
                }
            </a>,
            <a className="dropdown-item settingsMenuItem" key="gamify" href="#" id="gamify" onPress={this.toggleGamify}>
                <Text style={{ fontFamily: "fas", fontSize: 20 }}>{icon["gamepad"]}</Text>
                <span className="settingName">Gamify</span>
                <Text style={[{ fontFamily: "fas", fontSize: 20 }, "settingOptionCheckmark " + (this.props.settings.gamify ? "active" : "inactive")]}>{icon["check-circle"]}</Text>
            </a>,
            <a className="dropdown-item settingsMenuItem" key="randomPlaylist" href="#" id="randomPlaylist" onPress={this.toggleRandomPlaylist}>
                <Text style={{ fontFamily: "fas", fontSize: 20 }}>{icon["random"]}</Text>
                <span className="settingName">Shuffle playlist</span>
                <Text style={[{ fontFamily: "fas", fontSize: 20 }, "settingOptionCheckmark " + (this.props.settings.randomPlaylist ? "active" : "inactive")]}>{icon["check-circle"]}</Text>
            </a>,
            <a className="dropdown-item settingsMenuItem" key="randomQueue" href="#" id="randomQueue" onPress={this.toggleRandomQueue}>
                <Text style={{ fontFamily: "fas", fontSize: 20 }}>{icon["dice"]}</Text>
                <span className="settingName">Shuffle queue</span>
                <Text style={[{ fontFamily: "fas", fontSize: 20 }, "settingOptionCheckmark " + (this.props.settings.randomQueue ? "active" : "inactive")]}>{icon["check-circle"]}</Text>
            </a>,
            <a className="dropdown-item settingsMenuItem" key="skipThreshold" href="#" id="skipThreshold">
                <Text style={{ fontFamily: "fas", fontSize: 20 }}>{icon["thumbs-down"]}</Text>
                <span className="settingName">Skip if downvoted by {this.props.settings.skipThreshold} users</span>
                <NumberSetting value={this.props.settings.skipThreshold} step={1} updateValue={this.updateSkipThreshold} />
            </a>,
            <a className="dropdown-item settingsMenuItem " key="duplicates" href="#" id="duplicates">
                <Text style={{ fontFamily: "fas", fontSize: 20 }}>{icon["clone"]}</Text>
                <span className="settingName">Max {this.props.settings.maxDuplicateTracks} duplicate songs in queue</span>
                <NumberSetting value={this.props.settings.maxDuplicateTracks} step={1} updateValue={this.updateDuplicates} />
            </a>,
            <a className="dropdown-item settingsMenuItem " key="sequential" href="#" id="sequential">
                <Text style={{ fontFamily: "fas", fontSize: 20 }}>{icon["layer-group"]}</Text>
                <span className="settingName">Max {this.props.settings.maxSequentialTracks} sequential songs per user</span>
                <NumberSetting value={this.props.settings.maxSequentialTracks} step={1} updateValue={this.updateSequential} />
            </a>,
            <a className="dropdown-item settingsMenuItem " key="spotifyLogin" href="#" id="spotifyLogin" onPress={this.toggleSpotifyLogin}>
                <Text style={{ fontFamily: "fab", fontSize: 20 }}>{icon["spotify"]}</Text>
                <span className="settingName">Require Spotify login for users</span>
                <FontAwesomeIcon className={"settingOptionCheckmark " + (this.props.settings.spotifyLogin ? "active" : "inactive")} icon="check-circle" />
            </a>
        ]);
    }

    hideMenu() {
        this.setState({
            dropdownVisible: false
        });
    }

    render() {
        return (
            <View>
                <Button style={{ fontFamily: "fas", fontSize: 20 }}
                        onPress={this.dropdownClicked}
                        title={icon["cog"]} />
                <View className={"dropdown-menu settingsDropdown " + (this.state.dropdownVisible ? "show" : "hide")} aria-labelledby="settingsMenuButton">
                    {this.renderSettingsOptions()}
                </View>
                <View className={"menuOverlay " + (this.state.dropdownVisible ? "visible" : "hidden")} onPress={this.hideMenu}/>
            </View>
        );
    }
}

export default Settings;
