import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import * as React from "react";
import NumberSetting from "./NumberSetting";

export interface ISettings {
    name: string;
    gamify: boolean;
    maxDuplicateTracks: number;
    numberOfTracksPerUser: number;
    randomPlaylist: boolean;
    randomQueue: boolean;
    skipThreshold: number;
    playlist: string;
    maxSequentialTracks: number;
    spotifyLogin: boolean;
}

export interface IShareProps {
    settings: ISettings;
    updateSettings: (settings: ISettings, updatedFields?: string[]) => void;
    onError: (msg: string) => void;
}

export interface IShareState {
    dropdownVisible: boolean;
    editName: boolean;
    name: string;
}

export class Settings extends React.Component<IShareProps, IShareState> {

    public constructor(props: IShareProps) {
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

    public toggleGamify(e: React.MouseEvent<HTMLElement>) {
        e.preventDefault();
        const settings = this.props.settings;
        settings.gamify = !settings.gamify;
        this.props.updateSettings(settings);
    }

    public toggleRandomPlaylist(e: React.MouseEvent<HTMLElement>) {
        e.preventDefault();
        const settings = this.props.settings;
        settings.randomPlaylist = !settings.randomPlaylist;
        this.props.updateSettings(settings);
    }

    public toggleRandomQueue(e: React.MouseEvent<HTMLElement>) {
        e.preventDefault();
        const settings = this.props.settings;
        settings.randomQueue = !settings.randomQueue;
        this.props.updateSettings(settings);
    }

    public toggleSpotifyLogin(e: React.MouseEvent<HTMLElement>) {
        e.preventDefault();
        const settings = this.props.settings;
        settings.spotifyLogin = !settings.spotifyLogin;
        this.props.updateSettings(settings);
    }

    public dropdownClicked(e: React.MouseEvent<HTMLElement>) {
        e.preventDefault();

        this.setState((prevState) => ({
            dropdownVisible: !prevState.dropdownVisible
        }));
    }

    public updateSkipThreshold(value: number) {
        this.props.settings.skipThreshold = value;
        this.props.updateSettings(this.props.settings);
    }

    public updateDuplicates(value: number) {
        this.props.settings.maxDuplicateTracks = value;
        this.props.updateSettings(this.props.settings);
    }

    public updateSequential(value: number) {
        this.props.settings.maxSequentialTracks = value;
        this.props.updateSettings(this.props.settings);
    }

    public editName() {
        this.setState({
            editName: true
        });
    }

    public handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
        e.preventDefault();
        this.setState({
            name: e.target.value
        });
    }

    public updateName(e: React.MouseEvent<HTMLElement>) {
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

    public renderSettingsOptions() {
        return ([
            <div className="dropdown-item settingsMenuItem" key="name" id="name" onClick={this.editName}>
                <FontAwesomeIcon icon="edit" />
                {this.state.editName ?
                    <form className="queueName">
                        <input type="text" value={this.state.name} onChange={this.handleNameChange} />
                        <button onClick={this.updateName}><FontAwesomeIcon icon="save" /></button>
                    </form> :
                    <span className="settingName">{this.state.name || "Queue name"}</span>
                }
            </div>,
            <a className="dropdown-item settingsMenuItem" key="gamify" href="#" id="gamify" onClick={this.toggleGamify}>
                <FontAwesomeIcon icon="gamepad" />
                <span className="settingName">Gamify</span>
                <FontAwesomeIcon className={"settingOptionCheckmark " + (this.props.settings.gamify ? "active" : "inactive")} icon="check-circle" />
            </a>,
            <a className="dropdown-item settingsMenuItem" key="randomPlaylist" href="#" id="randomPlaylist" onClick={this.toggleRandomPlaylist}>
                <FontAwesomeIcon icon="random" />
                <span className="settingName">Shuffle playlist</span>
                <FontAwesomeIcon className={"settingOptionCheckmark " + (this.props.settings.randomPlaylist ? "active" : "inactive")} icon="check-circle" />
            </a>,
            <a className="dropdown-item settingsMenuItem" key="randomQueue" href="#" id="randomQueue" onClick={this.toggleRandomQueue}>
                <FontAwesomeIcon icon="dice" />
                <span className="settingName">Shuffle queue</span>
                <FontAwesomeIcon className={"settingOptionCheckmark " + (this.props.settings.randomQueue ? "active" : "inactive")} icon="check-circle" />
            </a>,
            <a className="dropdown-item settingsMenuItem" key="skipThreshold" href="#" id="skipThreshold">
                <FontAwesomeIcon icon="thumbs-down" />
                <span className="settingName">Skip if downvoted by {this.props.settings.skipThreshold} users</span>
                <NumberSetting value={this.props.settings.skipThreshold} step={1} updateValue={this.updateSkipThreshold} />
            </a>,
            <a className="dropdown-item settingsMenuItem " key="duplicates" href="#" id="duplicates">
                <FontAwesomeIcon icon="clone" />
                <span className="settingName">Max {this.props.settings.maxDuplicateTracks} duplicate songs in queue</span>
                <NumberSetting value={this.props.settings.maxDuplicateTracks} step={1} updateValue={this.updateDuplicates} />
            </a>,
            <a className="dropdown-item settingsMenuItem " key="sequential" href="#" id="sequential">
                <FontAwesomeIcon icon="layer-group" />
                <span className="settingName">Max {this.props.settings.maxSequentialTracks} sequential songs per user</span>
                <NumberSetting value={this.props.settings.maxSequentialTracks} step={1} updateValue={this.updateSequential} />
            </a>,
            <a className="dropdown-item settingsMenuItem " key="spotifyLogin" href="#" id="spotifyLogin" onClick={this.toggleSpotifyLogin}>
                <FontAwesomeIcon icon={["fab", "spotify"]} />
                <span className="settingName">Require Spotify login for users</span>
                <FontAwesomeIcon className={"settingOptionCheckmark " + (this.props.settings.spotifyLogin ? "active" : "inactive")} icon="check-circle" />
            </a>
        ]);
    }

    public hideMenu() {
        this.setState({
            dropdownVisible: false
        });
    }

    public render() {
        return (
            <div className="dropup">
                <button className="btn btn-secondary footerMenu"
                        onClick={this.dropdownClicked}
                        type="button"
                        id="settingsMenuButton"
                        data-toggle="dropdown"
                        aria-haspopup="true"
                        aria-expanded="false">
                    <FontAwesomeIcon icon="cog" />
                </button>
                <div className={"dropdown-menu settingsDropdown " + (this.state.dropdownVisible ? "show" : "hide")} aria-labelledby="settingsMenuButton">
                    {this.renderSettingsOptions()}
                </div>
                <div className={"menuOverlay " + (this.state.dropdownVisible ? "visible" : "hidden")} onClick={this.hideMenu}/>
            </div>
        );
    }
}

export default Settings;
