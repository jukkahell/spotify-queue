import { IconProp } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import * as React from "react";

export interface IShareProps {
    onError: (msg: string) => void;
    passcode: string;
}

export interface IShareState {
    shareOptions: string[];
    selectedShare: string | null;
    dropdownVisible: boolean;
}

export class Share extends React.Component<IShareProps, IShareState> {

    public constructor(props: IShareProps) {
        super(props);

        const url = "https://spotiqu.eu/#join:" + this.props.passcode;
        const shareOptions = [url, `Copy link`];
        const navigator: any = window.navigator;
        if (navigator.share) {
            shareOptions.push("Choose app");
        }
        this.state = {
            shareOptions,
            selectedShare: null,
            dropdownVisible: false
        };

        this.selectShare = this.selectShare.bind(this);
        this.dropdownClicked = this.dropdownClicked.bind(this);
        this.hideMenu = this.hideMenu.bind(this);
    }

    public selectShare(e: React.MouseEvent<HTMLElement>) {
        e.preventDefault();

        const url = "https://spotiqu.eu/#join:" + this.props.passcode;
        switch (e.currentTarget.id) {
            case "Copy link":
                this.copyText(url);
                break;
            case "Choose app":
                this.chooseApp("Join my queue:", url);
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

    public renderShareOptions() {
        return this.state.shareOptions.map((share: string, i: number) => (
            <a className={"dropdown-item"} key={"share-" + i} href="#" id={share} onClick={this.selectShare}>
                <FontAwesomeIcon icon={this.shareToIcon(share)} /> {share}
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
                        id="shareMenuButton"
                        data-toggle="dropdown"
                        aria-haspopup="true"
                        aria-expanded="false">
                    <FontAwesomeIcon icon="share-alt" />
                </button>
                <div className={"dropdown-menu " + (this.state.dropdownVisible ? "show" : "hide")} aria-labelledby="shareMenuButton">
                    {this.renderShareOptions()}
                </div>
                <div className={"menuOverlay " + (this.state.dropdownVisible ? "visible" : "hidden")} onClick={this.hideMenu}/>
            </div>
        );
    }

    private shareToIcon(share: string): IconProp {
        switch (share) {
            case "Copy link":
                return "link";
            case "Choose app":
                return "share";
            default:
                return "link";
        }
    }

    private copyText(text: string) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("Copy");
        textArea.remove();
    }

    private chooseApp(text: string, url: string) {
        const navigator: any = window.navigator;
        navigator.share({
            title: document.title,
            text,
            url
        }).catch((err: any) => console.log("Error sharing:", err));
    }
}

export default Share;
