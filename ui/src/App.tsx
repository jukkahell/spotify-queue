import axios from "axios";
import * as React from "react";
import "./App.css";
import Track, {ITrackProps} from "./Track";

export interface IProps {
    track?: string;
}

export interface IState {
    q: string;
    tracks: ITrackProps[];
}

export class App extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
        super(props);
        this.state = {
            q: "",
            tracks: []
        };
        this.search = this.search.bind(this);
        this.handleChangeEvent = this.handleChangeEvent.bind(this);
    }

    public handleChangeEvent(e: React.ChangeEvent<HTMLInputElement>) {
        e.preventDefault();

        this.setState({
            q: e.target.value
        });
    }

    public search(e: React.MouseEvent<HTMLElement>) {
        e.preventDefault();

        axios.get("http://10.4.1.40:8000/search?q=" + this.state.q)
            .then(response => {
                this.setState({
                    tracks: response.data.tracks
                });
            }).catch(error => {
                console.log(error);
            }
        );
    }

    protected renderTracks() {
        return this.state.tracks.map(track => (
            <Track name={track.name} artist={track.artist} id={track.id}/>
        ));
    }

    public render() {
        return (
            <div className="container">
                <div id="login">
                    <h1>Digia Spotify Queue!</h1>
                    <a href="/login" className="btn btn-primary">Log in with Spotify</a>
                </div>
                <form>
                    <input type="text" name="q" onChange={this.handleChangeEvent}/>
                    <button onClick={this.search}>Search</button>
                </form>
                <div>
                    <h3>Tracks</h3>
                    {this.renderTracks()}
                </div>
            </div>
        );
    }
}

export default App;
