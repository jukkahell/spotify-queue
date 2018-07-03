import axios from "axios";
import * as React from "react";
import "./App.css";
import CurrentlyPlaying from "./CurrentlyPlaying";
import Track, {ITrackProps} from "./Track";

export interface IProps {
    track?: string;
}

export interface IState {
    q: string;
    tracks: ITrackProps[];
    queue: ITrackProps[];
    responseMsg: string | null;
}

export class App extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
        super(props);
        this.state = {
            q: "",
            tracks: [],
            queue: [],
            responseMsg: null
        };
        this.search = this.search.bind(this);
        this.handleChangeEvent = this.handleChangeEvent.bind(this);
        this.onQueued = this.onQueued.bind(this);
        this.getQueue();
    }

    public getQueue() {
        axios.get("http://spotique.fi:8000/queue")
            .then(response => {
                this.setState({
                    queue: response.data.tracks
                });
            }).catch(error => {
                console.log(error);
            }
        );
    }

    public handleChangeEvent(e: React.ChangeEvent<HTMLInputElement>) {
        e.preventDefault();

        this.setState({
            q: e.target.value
        });
    }

    public search(e: React.MouseEvent<HTMLElement>) {
        e.preventDefault();

        axios.get("http://spotique.fi:8000/search?q=" + this.state.q)
            .then(response => {
                this.setState({
                    tracks: response.data.tracks
                });
            }).catch(error => {
                console.log(error);
            }
        );
    }

    protected onQueued() {
        this.setState({
            responseMsg: "Song added to the queue"
        });
        setTimeout(() => {
            this.setState({
                responseMsg: null
            });
        }, 3000);

        this.getQueue();
    }

    protected renderTracks() {
        return this.state.tracks.map((track, i) => (
            <Track
                name={track.name}
                artist={track.artist}
                id={track.id}
                key={i + "-" + track.id}
                onQueued={this.onQueued} />
        ));
    }

    protected renderQueue() {
        return this.state.queue.map((track, i) => (
            <li>
                <Track
                    name={track.name}
                    artist={track.artist}
                    id={track.id}
                    key={i + "-" + track.id}
                    onQueued={this.onQueued} />
            </li>
        ));
    }

    protected renderResponseMsg() {
        if (this.state.responseMsg) {
            return <div className="alert alert-success fixed-top" role="alert">{this.state.responseMsg}</div>;
        } else {
            return;
        }
    }

    public render() {
        return (
            <div className="container">
                {this.renderResponseMsg()}

                <CurrentlyPlaying />

                <form className="form-inline">
                    <input className="form-control search" type="text" name="q" onChange={this.handleChangeEvent}/>
                    <button type="submit" className="btn btn-primary search" onClick={this.search}>Search</button>
                </form>
                <div>
                    <h3>Tracks</h3>
                    {this.renderTracks()}
                </div>
                <div>
                    <h3>Queue</h3>
                    <ol>
                        {this.renderQueue()}
                    </ol>
                </div>
            </div>
        );
    }
}

export default App;
