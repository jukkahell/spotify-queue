import axios from "axios";
import * as Querystring from "querystring";
import * as React from "react";
import Album, { IAlbumProps } from "./Album";
import Artist, { IArtistProps } from "./Artist";
import config from "./config";
import Track, { ITrackProps } from "./Track";

interface ISearchFormProps {
    onQueued: () => void;
    onError: (msg: string) => void;
}

interface ISearchFormState {
    q: string;
    type: string;
    limit: number;
    tracks: ITrackProps[];
    albums: IAlbumProps[];
    artists: IArtistProps[];
}

export class SearchForm extends React.Component<ISearchFormProps, ISearchFormState> {

    public constructor(props: ISearchFormProps) {
        super(props);
        this.state = {
            q: "",
            type: "track,album,artist",
            limit: 5,
            tracks: [],
            albums: [],
            artists: []
        };

        this.search = this.search.bind(this);
        this.searchClicked = this.searchClicked.bind(this);
        this.handleChangeEvent = this.handleChangeEvent.bind(this);
        this.selectAlbum = this.selectAlbum.bind(this);
        this.selectArtist = this.selectArtist.bind(this);
        this.hashSearch = this.hashSearch.bind(this);

        this.hashSearch();
    }

    public componentDidMount() {
        window.addEventListener("hashchange", this.hashSearch, false);
    }

    public componentWillUnmount() {
        window.removeEventListener("hashchange", this.hashSearch, false);
    }

    public handleChangeEvent(e: React.ChangeEvent<HTMLInputElement>) {
        e.preventDefault();

        this.setState({
            q: e.target.value
        });
    }

    protected hashSearch() {
        const hash = window.location.hash.substr(1);

        if (!hash) {
            return;
        } else if (hash.indexOf(":") < 0) {
            const searchQuery = decodeURIComponent(hash.replace(/\+/g, " "));
            this.search(searchQuery);
        } else if (hash.indexOf("album") >= 0) {
            const id = window.location.hash.split(":")[1];
            this.selectAlbum(id);
        } else if (hash.indexOf("artist") >= 0) {
            const id = window.location.hash.split(":")[1];
            this.selectArtist(id);
        }
    }

    protected renderArtists() {
        if (this.state.artists.length === 0) {
            return null;
       }

        const artists = [
            (<h4 key="artists">Artists</h4>)
        ];
        return artists.concat(this.state.artists.map((artist, i) => (
            <Artist
                name={artist.name}
                id={artist.id}
                key={i + "-" + artist.id} />
        )));
    }

    protected selectArtist(id: string) {
        axios.get(config.backend.url + "/selectArtist?id=" + id)
            .then(response => {
                this.setState({
                    tracks: response.data.tracks,
                    albums: response.data.albums,
                    artists: []
                });
            }).catch(err => {
                this.props.onError(err.response.data.msg);
            }
        );
    }

    protected renderAlbums() {
        if (this.state.albums.length === 0) {
            return null;
       }

        const albums = [
            (<h4 key="albums">Albums</h4>)
        ];
        return albums.concat(this.state.albums.map((album, i) => (
            <Album
                name={album.name}
                artist={album.artist}
                id={album.id}
                key={i + "-" + album.id} />
        )));
    }

    protected selectAlbum(id: string) {
        axios.get(config.backend.url + "/selectAlbum?id=" + id)
            .then(response => {
                this.setState({
                    tracks: response.data,
                    albums: [],
                    artists: []
                });
            }).catch(err => {
                this.props.onError(err.response.data.msg);
            }
        );
    }

    protected renderTracks() {
        if (this.state.tracks.length === 0) {
             return null;
        }

        const tracks = [
            (<h4 key="tracks">Tracks</h4>)
        ];
        return tracks.concat(this.state.tracks.map((track, i) => (
            <Track
                name={track.name}
                artist={track.artist}
                id={track.id}
                duration={track.duration}
                key={i + "-" + track.id}
                isPlaying={false}
                onQueued={this.props.onQueued}
                onError={this.props.onError} />
        )));
    }

    public searchClicked(e: React.MouseEvent<HTMLElement>) {
        e.preventDefault();
        window.location.hash = "#" + this.state.q;
    }

    public search(q: string) {
        const params = {
            q,
            type: this.state.type,
            limit: this.state.limit
        };
        axios.get(config.backend.url + "/search?" + Querystring.stringify(params))
            .then(response => {
                this.setState({
                    tracks: response.data.tracks,
                    albums: response.data.albums,
                    artists: response.data.artists
                });
            }).catch(err => {
                this.props.onError(err.response.data.msg);
            }
        );
    }

    public render() {
        return (
            <div className="searchContainer">
                <form className="form-inline searchForm">
                    <input className="form-control search col-md-9" type="text" name="q" onChange={this.handleChangeEvent} placeholder="🔍 Search" />
                    <button type="submit" className="btn btn-primary search col-md-2" onClick={this.searchClicked}>Search</button>
                </form>
                <div className="searchResults">
                    {this.renderArtists()}
                    {this.renderAlbums()}
                    {this.renderTracks()}
                </div>
            </div>
        );
    }
}

export default SearchForm;
