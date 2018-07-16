import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import * as React from "react";

export interface IShareProps {
    onError: (msg: string) => void;
}

export interface IShareState {
    settingsOptions: string[];
    dropdownVisible: boolean;
}

export class Settings extends React.Component<IShareProps, IShareState> {

    public constructor(props: IShareProps) {
        super(props);

        this.state = {
            settingsOptions: ["Gamify"],
            dropdownVisible: false
        };

        this.toggleGamify = this.toggleGamify.bind(this);
        this.dropdownClicked = this.dropdownClicked.bind(this);
        this.hideMenu = this.hideMenu.bind(this);
    }

    public toggleGamify(e: React.MouseEvent<HTMLElement>) {
        console.log("Gamify");
    }

    public dropdownClicked(e: React.MouseEvent<HTMLElement>) {
        e.preventDefault();

        this.setState((prevState) => ({
            dropdownVisible: !prevState.dropdownVisible
        }));
    }

    public renderSettingsOptions() {
        return ([
            <a className={"dropdown-item"} key="gamify" href="#" id="gamify" onClick={this.toggleGamify}>
                <FontAwesomeIcon icon="gamepad" /> Gamify
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
