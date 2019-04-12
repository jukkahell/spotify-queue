import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import axios from "axios";
import * as React from "react";
import YouTube from "react-youtube";
import { IUser } from "./App";
import config from "./config";
import { IQueuedItem, IVote } from "./Queue";

interface ICurrentlyPlayingProps {
    onSongEnd: () => void;
    onError: (msg: string) => void;
    onPauseResume: () => void;
    onVoted: () => void;
    refreshData: () => void;
    onYouTubeTrackEnd: () => void;
    currentTrack: IQueuedItem | null;
    isPlaying: boolean;
    isOwner: boolean;
    user: IUser | null;
}

interface ICurrentlyPlayingState {
    trackId: string;
    progress: number;
    progressUpdated: number;
    lastRefresh: number;
}

export class CurrentlyPlaying extends React.Component<ICurrentlyPlayingProps, ICurrentlyPlayingState> {

    private progressInterval: NodeJS.Timer;
    private youtubeProgressInterval: NodeJS.Timer;
    private YT_END = 0;
    private YT_PLAYING = 1;
    private YT_PAUSED = 2;

    public constructor(props: ICurrentlyPlayingProps) {
        super(props);
        this.state = {
            trackId: "",
            progress: 0,
            progressUpdated: 0,
            lastRefresh: (new Date).getTime()
        };

        this.voteUp = this.voteUp.bind(this);
        this.voteDown = this.voteDown.bind(this);
        this.onStateChange = this.onStateChange.bind(this);
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
                progressUpdated: (new Date).getTime(),
                lastRefresh: (new Date).getTime()
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
        let alreadyVoted = null;
        const vote = this.props.currentTrack.votes.find(v => v.userId === this.props.user!.id);
        if (this.props.user && vote) {
            alreadyVoted = vote;
        } else if (this.props.user && this.props.currentTrack.userId === this.props.user.id) {
            voteDisabled = true;
            voteDisabledTitle = "Can't vote own songs";
        }

        let voteCount = 0;
        this.props.currentTrack.votes.forEach((v: IVote) => voteCount += v.value);
        return (
            <div className="voteButtons">
                <button disabled={voteDisabled} title={voteDisabledTitle} type="submit"
                  className={"btn btn-primary voteButton " + (alreadyVoted && alreadyVoted.value === 1 ? "voted" : "up")}
                  id={this.props.currentTrack.track.id} onClick={this.voteUp}>
                    <FontAwesomeIcon icon="thumbs-up" />
                </button>
                <div className="voteCount">{voteCount > 0 ? "+" : ""}{voteCount}</div>
                <button disabled={voteDisabled} title={voteDisabledTitle} type="submit"
                  className={"btn btn-primary voteButton " + (alreadyVoted && alreadyVoted.value === -1 ? "voted" : "down")}
                  id={this.props.currentTrack.track.id} onClick={this.voteDown}>
                    <FontAwesomeIcon icon="thumbs-down" />
                </button>
            </div>
        );
    }

    protected renderSpotifyTrack() {
        const progress = (this.state.progress / this.props.currentTrack!.track.duration) * 100;
        const pauseVisible = this.props.isOwner && this.props.isPlaying;
        const resumeVisible = this.props.isOwner && !this.props.isPlaying;
        return (
            <div className="currentlyPlaying col-md-12">
                <div className="coverImageContainer" onClick={this.props.onPauseResume}>
                    <img className="coverImage" src={this.props.currentTrack!.track.cover} />
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
    }

    protected renderYoutubeTrack() {
        const progress = (this.state.progress / this.props.currentTrack!.track.duration) * 100;
        const autoplay: 1 | 0 = 1;
        const controls: 0 | 1 | 2 = 0;
        const loop: 0 | 1 = 0;
        const showinfo: 0 | 1 = 0;
        const disablekb: 0 | 1 = 1;
        const modestbranding: 0 | 1 = 1;
        const enablejsapi: 0 | 1 = 1;
        const rel: 0 | 1 = 0;
        const opts = {
            height: "380px",
            width: "100%",
            playerVars: {
                enablejsapi,
                autoplay,
                controls,
                loop,
                origin: config.hostname,
                showinfo,
                disablekb,
                modestbranding,
                rel
            }
        };

        return (
            <div className="currentlyPlaying col-md-12">
                <YouTube videoId={this.props.currentTrack!.track.id} opts={opts} onStateChange={this.onStateChange} />
                <div className="progress">
                    <div className="progress-bar" style={{width: progress + "%"}} role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} />
                </div>
                {this.renderVoteButtons()}
            </div>
        );
    }

    public render() {
        if (this.props.currentTrack) {
            if (this.props.currentTrack.source === "youtube") {
                return this.renderYoutubeTrack();
            } else {
                return this.renderSpotifyTrack();
            }
        } else {
            return (
                <div className="currentlyPlaying col-md-12">
                    <div className="coverImageContainer" onClick={this.props.onPauseResume}>
                        <div className={"coverImageLayer visible"}>
                            <div className="align-center w-100"><FontAwesomeIcon icon="play-circle" /></div>
                        </div>
                    </div>
                </div>
            );
        }
    }

    private onStateChange(event: any) {
        if (event.data === this.YT_PLAYING) {
            this.startYoutubeProgress(event.target);
        } else if (event.data === this.YT_PAUSED) {
            clearInterval(this.youtubeProgressInterval);
        } else if (event.data === this.YT_END) {
            this.props.onYouTubeTrackEnd();
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

            const elapsedSinceLastRefresh = (new Date).getTime() - this.state.lastRefresh;
            if (elapsedSinceLastRefresh > 60 * 1000) {
                this.setState(() => ({
                    lastRefresh: (new Date).getTime()
                }), this.props.refreshData);
            }

            const progress = (this.state.progress / this.props.currentTrack!.track.duration) * 100;

            if (progress >= 100) {
                clearInterval(this.progressInterval);
                this.props.onSongEnd();
            }
        }, 500);
    }

    private startYoutubeProgress(player: any) {
        this.youtubeProgressInterval = setInterval(() => {
            const playerCurrentTime = player.getCurrentTime() * 1000;
            this.setState(() => ({
                progress: playerCurrentTime
            }));
        }, 1000);
    }
}

export default CurrentlyPlaying;
