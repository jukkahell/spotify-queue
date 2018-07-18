import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import * as React from "react";

export interface ISettings {
    gamify: boolean;
    maxDuplicateTracks: number;
    numberOfTracksPerUser: number;
    randomPlaylist: boolean;
    randomQueue: boolean;
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
