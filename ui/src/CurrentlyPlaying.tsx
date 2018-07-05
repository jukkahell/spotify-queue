import axios from "axios";
import * as React from "react";

interface ICurrentlyPlayingProps {
    onSongEnd: () => void;
}

interface ICurrentlyPlayingState {
    name: string;
    artist: string;
    cover: string;
    duration: number;
    progress: number;
    isPlaying: boolean;
    progressUpdated: number;
}

export class CurrentlyPlaying extends React.Component<ICurrentlyPlayingProps, ICurrentlyPlayingState> {

    private progressInterval: NodeJS.Timer;

    public constructor(props: ICurrentlyPlayingProps) {
        super(props);
        this.state = {
            name: "",
            artist: "",
            cover: "",
            duration: 0,
            progress: 0,
            isPlaying: false,
            progressUpdated: 0
        };

        this.getCurrentlyPlaying();
    }

    public componentWillReceiveProps(nextProps: ICurrentlyPlayingProps) {
        this.getCurrentlyPlaying();
    }

    public getCurrentlyPlaying() {
        axios.get("http://spotique.fi:8000/currentlyPlaying")
            .then(response => {
                if (response.status === 200) {
                    this.setState({
                        name: response.data.name,
                        artist: response.data.artist,
                        cover: response.data.cover,
                        duration: response.data.duration,
                        progress: response.data.progress,
                        isPlaying: response.data.isPlaying
                    });

                    clearInterval(this.progressInterval);

                    if (this.state.isPlaying) {
                        this.progressInterval = setInterval(() => {
                            const elapsed = (new Date).getTime() - this.state.progressUpdated;
                            this.setState({
                                progress: (this.state.progress + elapsed),
                                progressUpdated: (new Date).getTime()
                            });

                            const progress = (this.state.progress / this.state.duration) * 100;
                            if (progress > 100) {
                                clearInterval(this.progressInterval);
                                this.props.onSongEnd();
                            }
                        }, 500);
                    }
                }
            }).catch(err => {
                console.log(err);
            }
        );
    }

    public render() {
        if (this.state.artist) {
            const progress = (this.state.progress / this.state.duration) * 100;

            return (
                <div className="currentlyPlaying col-md-12">
                    <h4>{this.state.artist} - {this.state.name}</h4>
                    <img className="coverImage" src={this.state.cover} />
                    <div className="progress fixed-bottom">
                        <div className="progress-bar" style={{width: progress + "%"}} role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} />
                    </div>
                </div>
            );
        } else {
            return null;
        }
    }
}

export default CurrentlyPlaying;
