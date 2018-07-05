import axios from "axios";
import * as Querystring from "querystring";
import * as React from "react";
import Album, { IAlbumProps } from "./Album";
import Artist, { IArtistProps } from "./Artist";
import Track, { ITrackProps } from "./Track";

interface ISearchFormProps {
    onQueued: () => void;
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
        this.handleChangeEvent = this.handleChangeEvent.bind(this);
        this.selectAlbum = this.selectAlbum.bind(this);
        this.selectArtist = this.selectArtist.bind(this);
    }

    public handleChangeEvent(e: React.ChangeEvent<HTMLInputElement>) {
        e.preventDefault();

        this.setState({
            q: e.target.value
        });
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
                key={i + "-" + artist.id}
                onArtistSelected={this.selectArtist} />
        )));
    }

    protected selectArtist(tracks: ITrackProps[], albums: IAlbumProps[]) {
        this.setState({
            tracks,
            albums,
            artists: []
        });
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
                key={i + "-" + album.id}
                onAlbumSelected={this.selectAlbum} />
        )));
    }

    protected selectAlbum(tracks: ITrackProps[]) {
        this.setState({
            tracks,
            albums: [],
            artists: []
        });
    }

    protected renderTracks() {
        if (this.state.tracks.length === 0) {
             return null;
        }
        console.log(this.state.tracks);
        const tracks = [
            (<h4 key="tracks">Tracks</h4>)
        ];
        return tracks.concat(this.state.tracks.map((track, i) => (
            <Track
                name={track.name}
                artist={track.artist}
                id={track.id}
                key={i + "-" + track.id}
                onQueued={this.props.onQueued} />
        )));
    }

    public search(e: React.MouseEvent<HTMLElement>) {
        e.preventDefault();

        const params = {
            q: this.state.q,
            type: this.state.type,
            limit: this.state.limit
        };
        axios.get("http://spotique.fi:8000/search?" + Querystring.stringify(params))
            .then(response => {
                this.setState({
                    tracks: response.data.tracks,
                    albums: response.data.albums,
                    artists: response.data.artists
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
                    {this.renderArtists()}
                    {this.renderAlbums()}
                    {this.renderTracks()}
                </div>
            </div>
        );
    }
}

export default SearchForm;
