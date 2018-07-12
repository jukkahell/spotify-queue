import { IconProp } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import * as React from "react";
import axios from "../node_modules/axios";
import config from "./config";

export interface IUserMenuProps {
    onError: (msg: string) => void;
    passcode: string;
}

export interface IUserMenuState {
    menuOptions: string[];
    selectedMenuItem: string | null;
    dropdownVisible: boolean;
}

export class UserMenu extends React.Component<IUserMenuProps, IUserMenuState> {

    public constructor(props: IUserMenuProps) {
        super(props);

        this.state = {
            menuOptions: [
                "Logout"
            ],
            selectedMenuItem: null,
            dropdownVisible: false
        };

        this.selectMenuItem = this.selectMenuItem.bind(this);
        this.dropdownClicked = this.dropdownClicked.bind(this);
        this.logout = this.logout.bind(this);
    }

    public selectMenuItem(e: React.MouseEvent<HTMLElement>) {
        switch (e.currentTarget.id) {
            case "Logout":
                this.logout();
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

    private optionToIcon(share: string): IconProp {
        switch (share) {
            case "Logout":
                return "sign-out-alt";
            default:
                return "sign-out-alt";
        }
    }
}

export default UserMenu;
