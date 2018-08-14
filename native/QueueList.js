import icon from "./Icon";
import * as React from "react";
import { View, Button, Text } from "react-native";
import styles from "./styles";

export class QueueList extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            dropdownVisible: false
        };

        this.dropdownClicked = this.dropdownClicked.bind(this);
        this.hideMenu = this.hideMenu.bind(this);
        this.selectQueue = this.selectQueue.bind(this);
    }

    dropdownClicked(e) {
        e.preventDefault();
        this.setState((prevState) => ({
            dropdownVisible: !prevState.dropdownVisible
        }));
    }

    hideMenu() {
        this.setState(() => ({
            selectedUser: null,
            dropdownVisible: false
        }));
    }

    selectQueue(e) {
        e.preventDefault();

        if (this.props.passcode === e.currentTarget.id) {
            return;
        }

        this.props.selectQueue(e.currentTarget.id);
    }

    renderQueues() {
        if (!this.props.queues) {
            return null;
        }
        return this.props.queues.map((queue, i) => (
            <View style={[styles.userQueueListItem, (this.props.passcode === queue.passcode ? styles.selected : "")]}
                id={queue.passcode}
                key={"queue-" + i}
                onPress={this.selectQueue}>
                {this.props.passcode === queue.passcode
                    ? <Text style={{ fontFamily: "fas", fontSize: 20 }}>{icon["clipboard-check"]}</Text>
                    : <Text style={{ fontFamily: "fas", fontSize: 20 }}>{icon["clipboard-list"]}</Text>
                }
                <Text>{queue.name}</Text>
            </View>
        ));
    }

    render() {
        return (
            <View>
                <Button onPress={this.dropdownClicked} id="userMenuButton" title=""><Text style={{ fontFamily: "fas", fontSize: 20 }}>{icon["layer-group"]}</Text></Button>
                <View style={[styles.queuesDropdown, (this.state.dropdownVisible ? styles.show : styles.hide)]}>
                    {this.renderQueues()}
                </View>
                <View style={[styles.menuOverlay, (this.state.dropdownVisible ? styles.visible : styles.hidden)]} onPress={this.hideMenu}/>
            </View>
        );
    }
}

export default QueueList;
