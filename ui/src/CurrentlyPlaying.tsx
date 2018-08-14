import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import axios from "axios";
import * as React from "react";
import { IUser } from "./App";
import config from "./config";
import { IQueuedItem, IVote } from "./Queue";

interface ICurrentlyPlayingProps {
    onSongEnd: () => void;
    onError: (msg: string) => void;
    onPauseResume: () => void;
    onVoted: () => void;
    currentTrack: IQueuedItem | null;
    isPlaying: boolean;
    isOwner: boolean;
    user: IUser | null;
}

interface ICurrentlyPlayingState {
    trackId: string;
    progress: number;
    progressUpdated: number;
}

export class CurrentlyPlaying extends React.Component<ICurrentlyPlayingProps, ICurrentlyPlayingState> {

    private progressInterval: NodeJS.Timer;

    public constructor(props: ICurrentlyPlayingProps) {
        super(props);
        this.state = {
            trackId: "",
            progress: 0,
            progressUpdated: 0
        };

        this.voteUp = this.voteUp.bind(this);
        this.voteDown = this.voteDown.bind(this);
    }

    public componentDidMount() {
        if (this.props.isPlaying) {
            this.startProgress();
        }
    }

    public componentWillUnmount() {
        clearInterval(this.progressInterval);
    }

    public componentDidUpdate(prevProps: ICurrentlyPlayingProps) {
        if (this.props.currentTrack && ((this.props.currentTrack.track.id !== this.state.trackId) || (!prevProps.isPlaying && this.props.isPlaying))) {
            this.setState({
                trackId: this.props.currentTrack.track.id,
                progress: this.props.currentTrack.track.progress!,
                progressUpdated: (new Date).getTime()
            }, this.startProgress);
        } else if (!this.props.isPlaying) {
            clearInterval(this.progressInterval);
        }
    }

    protected vote(value: number) {
        axios.put(config.backend.url + "/vote", { value }).then(() => {
            this.props.onVoted();
        }).catch(err => {
            this.props.onError(err.response.data.message);
        });
    }

    protected voteUp(e: React.MouseEvent<HTMLButtonElement>) {
        this.vote(1);
    }

    protected voteDown(e: React.MouseEvent<HTMLButtonElement>) {
        this.vote(-1);
    }

    protected renderVoteButtons() {
        if (!this.props.currentTrack) {
            return null;
        }

        let voteDisabled = false;
        let voteDisabledTitle = "";
        if (this.props.user && this.props.currentTrack.votes.some(v => v.userId === this.props.user!.id)) {
            voteDisabled = true;
            voteDisabledTitle = "Already voted";
        } else if (this.props.user && this.props.currentTrack.userId === this.props.user.id) {
            voteDisabled = true;
            voteDisabledTitle = "Can't vote own songs";
        }

        let voteCount = 0;
        this.props.currentTrack.votes.forEach((v: IVote) => voteCount += v.value);
        return (
            <div className="voteButtons">
                <button disabled={voteDisabled} title={voteDisabledTitle} type="submit" className="btn btn-primary voteButton up" id={this.props.currentTrack.track.id} onClick={this.voteUp}>
                    <FontAwesomeIcon icon="thumbs-up" />
                </button>
                <div className="voteCount">{voteCount > 0 ? "+" : ""}{voteCount}</div>
                <button disabled={voteDisabled} title={voteDisabledTitle} type="submit" className="btn btn-primary voteButton down" id={this.props.currentTrack.track.id} onClick={this.voteDown}>
                    <FontAwesomeIcon icon="thumbs-down" />
                </button>
            </div>
        );
    }

    public render() {
        if (this.props.currentTrack) {
            const progress = (this.state.progress / this.props.currentTrack.track.duration) * 100;
            const pauseVisible = this.props.isOwner && this.props.isPlaying;
            const resumeVisible = this.props.isOwner && !this.props.isPlaying;
            return (
                <div className="currentlyPlaying col-md-12">
                    <div className="coverImageContainer" onClick={this.props.onPauseResume}>
                        <img className="coverImage" src={this.props.currentTrack.track.cover} />
                        <div className={"coverImageLayer " + (pauseVisible ? "visible" : "invisible")}>
                            <div className="align-center w-100"><FontAwesomeIcon icon="pause-circle" /></div>
                        </div>
                        <div className={"coverImageLayer " + (resumeVisible ? "visible" : "invisible")}>
                            <div className="align-center w-100"><FontAwesomeIcon icon="play-circle" /></div>
                        </div>
                    </div>
                    <div className="progress">
                        <div className="progress-bar" style={{width: progress + "%"}} role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} />
                    </div>
                    {this.renderVoteButtons()}
                </div>
            );
        } else {
            return null;
        }
    }

    private startProgress() {
        clearInterval(this.progressInterval);
        this.progressInterval = setInterval(() => {
            const elapsed = (new Date).getTime() - this.state.progressUpdated;
            this.setState((prevState) => ({
                progress: (prevState.progress + elapsed),
                progressUpdated: (new Date).getTime()
            }));

            const progress = (this.state.progress / this.props.currentTrack!.track.duration) * 100;

            if (progress >= 100) {
                clearInterval(this.progressInterval);
                this.props.onSongEnd();
            }
        }, 500);
    }
}

export default CurrentlyPlaying;
