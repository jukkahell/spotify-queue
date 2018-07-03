import axios from "axios";
import * as React from "react";

interface ICurrentlyPlayingState {
    name: string;
    artist: string;
    cover: string;
    duration: number;
    progress: number;
}

export class CurrentlyPlaying extends React.Component<{}, ICurrentlyPlayingState> {

    public constructor(props: {}) {
        super(props);
        this.state = {
            name: "",
            artist: "",
            cover: "",
            duration: 0,
            progress: 0
        };

        axios.get("http://spotique.fi:8000/currentlyPlaying")
            .then(response => {
                if (response.status === 200) {
                    this.setState({
                        name: response.data.name,
                        artist: response.data.artist,
                        cover: response.data.cover,
                        duration: response.data.duration,
                        progress: response.data.progress
                    });

                    setInterval(() => {
                        this.setState({
                            progress: (this.state.progress + 500)
                        });
                    }, 500);
                }
            }).catch(err => {
                console.log(err);
            }
        );
    }

    public render() {
        if (this.state.artist) {
            const progress = this.state.progress / this.state.duration * 100;

            return (
                <div className="currentlyPlaying">
                    <h2>{this.state.artist} - {this.state.name}</h2>
                    <img src={this.state.cover} />
                    <div className="progress">
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
