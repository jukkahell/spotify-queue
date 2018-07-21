import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import * as React from "react";
import NumberSetting from "./NumberSetting";

export interface ISettings {
    gamify: boolean;
    maxDuplicateTracks: number;
    numberOfTracksPerUser: number;
    randomPlaylist: boolean;
    randomQueue: boolean;
    skipThreshold: number;
}

export interface IShareProps {
    settings: ISettings;
    updateSettings: (settings: ISettings) => void;
    onError: (msg: string) => void;
}

export interface IShareState {
    dropdownVisible: boolean;
}

export class Settings extends React.Component<IShareProps, IShareState> {

    public constructor(props: IShareProps) {
        super(props);

        this.state = {
            dropdownVisible: false
        };

        this.toggleGamify = this.toggleGamify.bind(this);
        this.toggleRandomPlaylist = this.toggleRandomPlaylist.bind(this);
        this.toggleRandomQueue = this.toggleRandomQueue.bind(this);
        this.dropdownClicked = this.dropdownClicked.bind(this);
        this.hideMenu = this.hideMenu.bind(this);
        this.updateSkipThreshold = this.updateSkipThreshold.bind(this);
        this.updateDuplicates = this.updateDuplicates.bind(this);
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

    public renderSettingsOptions() {
        return ([
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
                <FontAwesomeIcon icon="random" />
                <span className="settingName">Shuffle queue</span>
                <FontAwesomeIcon className={"settingOptionCheckmark " + (this.props.settings.randomQueue ? "active" : "inactive")} icon="check-circle" />
            </a>,
            <a className="dropdown-item settingsMenuItem" key="skipThreshold" href="#" id="skipThreshold">
                <FontAwesomeIcon icon="thumbs-down" />
                <span className="settingName">Skip if downvoted by {this.props.settings.skipThreshold} users</span>
                <NumberSetting value={this.props.settings.skipThreshold} step={1} updateValue={this.updateSkipThreshold} />
            </a>,
            <a className="dropdown-item settingsMenuItem" key="duplicates" href="#" id="duplicates">
                <FontAwesomeIcon icon="clone" />
                <span className="settingName">Allow {this.props.settings.maxDuplicateTracks} duplicate songs in queue</span>
                <NumberSetting value={this.props.settings.maxDuplicateTracks} step={1} updateValue={this.updateDuplicates} />
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
                <div className={"dropdown-menu " + (this.state.dropdownVisible ? "show" : "hide")} aria-labelledby="settingsMenuButton">
                    {this.renderSettingsOptions()}
                </div>
                <div className={"menuOverlay " + (this.state.dropdownVisible ? "visible" : "hidden")} onClick={this.hideMenu}/>
            </div>
        );
    }
}

export default Settings;
