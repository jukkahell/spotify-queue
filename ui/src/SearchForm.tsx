import axios from "axios";
import * as React from "react";
import Track, { ITrackProps } from "./Track";

interface ISearchFormProps {
    onQueued: () => void;
}

interface ISearchFormState {
    q: string;
    searchResults: ITrackProps[];
}

export class SearchForm extends React.Component<ISearchFormProps, ISearchFormState> {

    public constructor(props: ISearchFormProps) {
        super(props);
        this.state = {
            q: "",
            searchResults: []
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

    protected renderTracks() {
        return this.state.searchResults.map((track, i) => (
            <Track
                name={track.name}
                artist={track.artist}
                id={track.id}
                key={i + "-" + track.id}
                onQueued={this.props.onQueued} />
        ));
    }

    public search(e: React.MouseEvent<HTMLElement>) {
        e.preventDefault();

        axios.get("http://spotique.fi:8000/search?q=" + this.state.q)
            .then(response => {
                this.setState({
                    searchResults: response.data.tracks
                });
            }).catch(error => {
                console.log(error);
            }
        );
    }

    public render() {
        return (
            <div className="searchContainer">
                <form className="form-inline searchForm">
                    <input className="form-control search col-md-10" type="text" name="q" onChange={this.handleChangeEvent} placeholder="🔍 Search" />
                    <button type="submit" className="btn btn-primary search col-md-2" onClick={this.search}>Search</button>
                </form>
                <div className="searchResults">
                    {this.renderTracks()}
                </div>
            </div>
        );
    }
}

export default SearchForm;
