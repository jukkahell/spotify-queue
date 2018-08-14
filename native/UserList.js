import icon from "./Icon";
import axios from "axios";
import * as React from "react";
import { View, Button, Text, FlatList } from "react-native";
import config from "./config";

export class UserList extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            dropdownVisible: false,
            selectedUser: null
        };

        this.dropdownClicked = this.dropdownClicked.bind(this);
        this.hideMenu = this.hideMenu.bind(this);
        this.selectUser = this.selectUser.bind(this);
        this.removeUser = this.removeUser.bind(this);
        this.resetUser = this.resetUser.bind(this);
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

    selectUser(e) {
        e.preventDefault();

        if (this.props.isOwner) {
            this.setState({
                selectedUser: e.currentTarget.id
            });
        }
    }

    removeUser(e) {
        e.preventDefault();

        if (window.confirm("Are you sure you want to remove this user?")) {
            axios.delete(config.backend.url + "/removeUser", {
                data: {
                    userId: e.currentTarget.id.split("remove-")[1]
                }
            }).then(() => {
                this.props.onEdit();
            }).catch(error => {
                this.props.onError(error.response.data.message);
            });
        }

        this.setState({
            selectedUser: null
        });
    }

    resetUser(e) {
        e.preventDefault();

        if (window.confirm("Are you sure you want to reset points for this user?")) {
            axios.put(config.backend.url + "/resetPoints", {
                userId: e.currentTarget.id.split("reset-")[1]
            }).then(() => {
                this.props.onEdit();
            }).catch(error => {
                this.props.onError(error.response.data.message);
            });
        }

        this.setState({
            selectedUser: null
        });
    }

    renderUsers() {
        if (!this.props.users) {
            return null;
        }
        return this.props.users.map((user, i) => (
            <View key={"user-" + i}>
                <View id={user.id} className={"userListItem " + (this.state.selectedUser === user.id ? "d-none" : "visible")} onPress={this.selectUser}>
                    <Text className="userId">{user.spotifyUserId || user.id}</Text>
                    <Text className="points">{user.points} pts</Text>
                </View>
                <View className={"userListContextMenu " + (this.state.selectedUser === user.id ? "visible" : "d-none")}>
                    <Text id={"remove-" + user.id} title="Remove from queue" onPress={this.removeUser}>
                        <Text style={{ fontFamily: "fas", fontSize: 20 }}>{icon["trash-alt"]}</Text>
                    </Text>
                    <Text id={"reset-" + user.id} title="Reset points" onPress={this.resetUser}>
                        <Text style={{ fontFamily: "fas", fontSize: 20 }}>{icon["undo"]}</Text>
                    </Text>
                </View>
            </View>
        ));
    }

    render() {
        return (
            <View>
                <Button onPress={this.dropdownClicked}
                        title="">
                    <Text style={{ fontFamily: "fas", fontSize: 20 }}>{icon["users"]}</Text>
                </Button>
                <FlatList data={this.renderUsers()} renderItem={({item}) => {item}} className={"dropdown-menu usersDropdown " + (this.state.dropdownVisible ? "show" : "hide")} aria-labelledby="userMenuButton" />
                <View className={"menuOverlay " + (this.state.dropdownVisible ? "visible" : "hidden")} onClick={this.hideMenu}/>
            </View>
        );
    }
}

export default UserList;
