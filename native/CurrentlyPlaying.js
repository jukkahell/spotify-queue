import axios from "axios";
import * as React from "react";
import config from "./config";
import icon from "./Icon";
import { View, Button, Image, Text, Dimensions } from "react-native";

export class CurrentlyPlaying extends React.Component {

    progressInterval;

    constructor(props) {
        super(props);
        this.state = {
            trackId: "",
            progress: 0,
            progressUpdated: 0
        };

        this.voteUp = this.voteUp.bind(this);
        this.voteDown = this.voteDown.bind(this);
    }

    componentDidMount() {
        if (this.props.isPlaying) {
            this.startProgress();
        }
    }

    componentWillUnmount() {
        clearInterval(this.progressInterval);
    }

    componentDidUpdate(prevProps) {
        if (this.props.currentTrack && ((this.props.currentTrack.track.id !== this.state.trackId) || (!prevProps.isPlaying && this.props.isPlaying))) {
            this.setState({
                trackId: this.props.currentTrack.track.id,
                progress: this.props.currentTrack.track.progress,
                progressUpdated: (new Date).getTime()
            }, this.startProgress);
        } else if (!this.props.isPlaying) {
            clearInterval(this.progressInterval);
        }
    }

    vote(value) {
        axios.put(config.backend.url + "/vote", { value }).then(() => {
            this.props.onVoted();
        }).catch(err => {
            this.props.onError(err.response.data.message);
        });
    }

    voteUp(e) {
        this.vote(1);
    }

    voteDown(e) {
        this.vote(-1);
    }

    renderVoteButtons() {
        if (!this.props.currentTrack) {
            return null;
        }

        let alreadyVoted = false;
        let alreadyVotedTitle = "";
        if (this.props.user && this.props.currentTrack.votes.some(v => v.userId === this.props.user.id)) {
            alreadyVoted = true;
            alreadyVotedTitle = "Already voted";
        }

        let voteCount = 0;
        this.props.currentTrack.votes.forEach((v) => voteCount += v.value);
        return (
            <View className="voteButtons">
                <Button disabled={alreadyVoted} title={alreadyVotedTitle} type="submit" className="btn btn-primary voteButton up" id={this.props.currentTrack.track.id} onPress={this.voteUp}>
                    <Text style={{ fontFamily: "fas", fontSize: 20 }}>{icon["thumbs-up"]}</Text>
                </Button>
                <Text className="voteCount">{voteCount > 0 ? "+" : ""}{voteCount}</Text>
                <Button disabled={alreadyVoted} title={alreadyVotedTitle} type="submit" className="btn btn-primary voteButton down" id={this.props.currentTrack.track.id} onPress={this.voteDown}>
                <Text style={{ fontFamily: "fas", fontSize: 20 }}>{icon["thumbs-down"]}</Text>
                </Button>
            </View>
        );
    }

    render() {
        if (this.props.currentTrack) {
            const progress = (this.state.progress / this.props.currentTrack.track.duration) * 100;
            const pauseVisible = this.props.isOwner && this.props.isPlaying;
            const resumeVisible = this.props.isOwner && !this.props.isPlaying;
            const {height, width} = Dimensions.get("window");

            return (
                <View>
                    <View onPress={this.props.onPauseResume}>
                        <Image source={{uri: this.props.currentTrack.track.cover}} style={{width, height: width}} />
                        <View className={"coverImageLayer " + (pauseVisible ? "visible" : "invisible")}>
                            <Text style={{ fontFamily: "fas", fontSize: 20 }}>{icon["pause-circle"]}</Text>
                        </View>
                        <View className={"coverImageLayer " + (resumeVisible ? "visible" : "invisible")}>
                            <Text style={{ fontFamily: "fas", fontSize: 20 }}>{icon["play-circle"]}</Text>
                        </View>
                    </View>
                    <View className="progress">
                        <View style={{width: progress + "%"}} />
                    </View>
                    {this.renderVoteButtons()}
                </View>
            );
        } else {
            return null;
        }
    }

    startProgress() {
        clearInterval(this.progressInterval);
        this.progressInterval = setInterval(() => {
            const elapsed = (new Date).getTime() - this.state.progressUpdated;
            this.setState((prevState) => ({
                progress: (prevState.progress + elapsed),
                progressUpdated: (new Date).getTime()
            }));

            const progress = (this.state.progress / this.props.currentTrack.track.duration) * 100;

            if (progress >= 100) {
                clearInterval(this.progressInterval);
                this.props.onSongEnd();
            }
        }, 500);
    }
}

export default CurrentlyPlaying;
