import * as React from "react";
import { Text, View, Button } from "react-native";
import icon from "./Icon";

export class Share extends React.Component {

    constructor(props) {
        super(props);

        const shareOptions = ["Copy link"];
        const navigator = window.navigator;
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

    selectShare(e) {
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

    dropdownClicked(e) {
        e.preventDefault();

        this.setState((prevState) => ({
            dropdownVisible: !prevState.dropdownVisible
        }));
    }

    renderShareOptions() {
        return this.state.shareOptions.map((share, i) => (
            <Text className={"dropdown-item"} key={"share-" + i} href="#" id={share} onPress={this.selectShare}>
                {this.shareToIcon(share)} {share}
            </Text>
        ));
    }

    hideMenu() {
        this.setState(() => ({
            dropdownVisible: false
        }));
    }

    render() {
        return (
            <View>
                <Button onPress={this.dropdownClicked}
                        title="">
                    <Text style={{ fontFamily: "fas", fontSize: 20 }}>{icon["share-alt"]}</Text>
                </Button>
                <View className={"dropdown-menu " + (this.state.dropdownVisible ? "show" : "hide")}>
                    {this.renderShareOptions()}
                </View>
                <View className={"menuOverlay " + (this.state.dropdownVisible ? "visible" : "hidden")} onPress={this.hideMenu}/>
            </View>
        );
    }

    shareToIcon(share) {
        switch (share) {
            case "Copy link":
                return <Text style={{ fontFamily: "fas", fontSize: 20 }}>{icon["link"]}</Text>
            case "Choose app":
                return <Text style={{ fontFamily: "fas", fontSize: 20 }}>{icon["share"]}</Text>
            default:
                return <Text style={{ fontFamily: "fas", fontSize: 20 }}>{icon["link"]}</Text>
        }
    }

    copyText(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("Copy");
        textArea.remove();
    }

    chooseApp(text, url) {
        const navigator = window.navigator;
        navigator.share({
            title: document.title,
            text,
            url
        }).catch((err) => console.log("Error sharing:", err));
    }
}

export default Share;
