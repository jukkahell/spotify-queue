import icon from "./Icon";
import axios from "axios";
import * as React from "react";
import Album from "./Album";
import Artist from "./Artist";
import config from "./config";
import Playlist from "./Playlist";
import Track from "./Track";
import styles from "./styles";
import { View, Text, TextInput } from "react-native";

export class SearchForm extends React.Component {

    searchTimeout;
    defaultLimit = "5";
    defaultTypes = "track,album,artist";

    constructor(props) {
        super(props);
        this.state = {
            search: {
                q: "",
                type: this.defaultTypes,
                limit: this.defaultLimit,
            },
            tracks: [],
            albums: [],
            artists: [],
            playlists: []
        };

        this.search = this.search.bind(this);
        this.executeSearch = this.executeSearch.bind(this);
        this.handleChangeEvent = this.handleChangeEvent.bind(this);
        this.selectAlbum = this.selectAlbum.bind(this);
        this.selectArtist = this.selectArtist.bind(this);
        this.showMoreArtists = this.showMoreArtists.bind(this);
        this.showMoreAlbums = this.showMoreAlbums.bind(this);
        this.getPlaylists = this.getPlaylists.bind(this);
        this.selectPlaylist = this.selectPlaylist.bind(this);
        this.addToQueue = this.addToQueue.bind(this);
        this.queuePlaylist = this.queuePlaylist.bind(this);
        this.showMoreTracks = this.showMoreTracks.bind(this);
        this.clearSearch = this.clearSearch.bind(this);
        this.getPlaylists();
    }

    handleChangeEvent(e) {
        e.preventDefault();

        const search = this.state.search;
        search.q = e.target.value;
        if (search.q.length > 2) {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(this.executeSearch, 1000);
        }
        this.setState({
            search
        });
    }

    clearSearch() {
        const search = this.state.search;
        search.q = "";
        this.setState({
            search
        });
    }

    componentDidUpdate(prevProps) {
        if (prevProps.user !== this.props.user) {
            this.getPlaylists();
        }
    }

    renderPlaylists() {
        if (this.state.playlists.length === 0) {
            return null;
        }

        const playlists = [
            (<Text key="playlists">Playlists</Text>)
        ];
        return playlists.concat(this.state.playlists.map((playlist, i) => (
            <Playlist
                name={playlist.name}
                id={playlist.id}
                settings={this.props.settings}
                key={i + "-" + playlist.id}
                isOwner={this.props.isOwner}
                addToQueue={this.queuePlaylist} />
        )));
    }

    renderArtists() {
        if (this.state.artists.length === 0) {
            return null;
       }

        const artists = [
            <Text key="artists">Artists</Text>
        ];
        return artists.concat(this.state.artists.map((artist, i) => (
            <Artist
                name={artist.name}
                id={artist.id}
                key={i + "-" + artist.id} />
        )));
    }

    selectPlaylist(id) {
        axios.get(config.backend.url + "/playlist?id=" + id)
            .then(response => {
                this.setState({
                    tracks: response.data.tracks,
                    artists: [],
                    albums: [],
                    playlists: []
                });
            }).catch(err => {
                this.props.onError(err.response.data.message);
            }
        );
    }

    queuePlaylist(id) {
        axios.put(config.backend.url + "/queuePlaylist", { id })
            .then(() => {
                this.props.onPlaylistSelected();
            }).catch(err => {
                this.props.onError(err.response.data.message);
            }
        );
    }

    selectArtist(id, isPlaying) {
        axios.get(config.backend.url + "/selectArtist?id=" + id)
            .then(response => {
                this.setState({
                    tracks: response.data.tracks,
                    albums: response.data.albums,
                    artists: [],
                    playlists: []
                });
            }).catch(err => {
                this.props.onError(err.response.data.message);
            }
        );
    }

    renderAlbums() {
        if (this.state.albums.length === 0) {
            return null;
       }

        const albums = [
            <Text key="albums">Albums</Text>
        ];
        return albums.concat(this.state.albums.map((album, i) => (
            <Album
                name={album.name}
                artist={album.artist}
                id={album.id}
                artistId={album.artistId}
                key={i + "-" + album.id} />
        )));
    }

    selectAlbum(id) {
        axios.get(config.backend.url + "/selectAlbum?id=" + id)
            .then(response => {
                this.setState({
                    tracks: response.data,
                    albums: [],
                    artists: [],
                    playlists: []
                });
            }).catch(err => {
                this.props.onError(err.response.data.message);
            }
        );
    }

    addToQueue(targetId, isPlaying) {
        axios.post(config.backend.url + "/track", { spotifyUri: targetId })
            .then(() => {
                this.props.onQueued();
            }).catch(err => {
                this.props.onError(err.response.data.message);
            }
        );
    }

    renderTracks() {
        if (this.state.tracks.length === 0) {
             return null;
        }

        const tracks = [
            <Text key="tracks">Tracks</Text>
        ];
        return tracks.concat(this.state.tracks.map((track, i) => (
            <Track
                name={track.name}
                artist={track.artist}
                id={track.id}
                artistId={track.artistId}
                duration={track.duration}
                key={i + "-" + track.id}
                isPlaying={false}
                selectTrack={this.addToQueue} />
        )));
    }

    executeSearch() {
        if (this.state.search.q) {
            this.setState({
                search: {
                    q: this.state.search.q,
                    type: this.defaultTypes,
                    limit: this.defaultLimit
                }
            });
        }
    }

    search() {
        axios.post(config.backend.url + "/search", this.state.search)
            .then(response => {
                this.setState({
                    tracks: response.data.tracks,
                    albums: response.data.albums,
                    artists: response.data.artists,
                    playlists: []
                });
            }).catch(err => {
                this.props.onError(err.response.data.message);
            }
        );
    }

    getPlaylists() {
        if (this.props.user && this.props.user.spotifyUserId) {
            axios.get(config.backend.url + "/playlists")
                .then(response => {
                    this.setState({
                        tracks: [],
                        albums: [],
                        artists: [],
                        playlists: response.data
                    });
                }).catch(err => {
                    this.props.onError(err.response.data.message);
                }
            );
        }
    }

    showMoreArtists(e) {
        e.preventDefault();
        this.setState({
            search: {
                q: this.state.search.q,
                type: "artist",
                limit: 50
            }
        }, () => this.search());
    }

    showMoreAlbums(e) {
        e.preventDefault();
        this.setState({
            search: {
                q: this.state.search.q,
                type: "album",
                limit: 50
            }
        }, () => this.search());
    }

    showMoreTracks(e) {
        e.preventDefault();
        this.setState({
            search: {
                q: this.state.search.q,
                type: "track",
                limit: 50
            }
        }, () => this.search());
    }

    render() {
        return (
            <View style={styles.searchContainer}>
                <TextInput type="hidden" name="type" value={this.defaultTypes} />
                <TextInput type="hidden" name="limit" value={this.defaultLimit} />
                <TextInput type="hidden" name="q" value={this.state.search.q} />
                <Text style={{ fontFamily: "fas", fontSize: 20 }}>{icon["search"]}</Text>
                <TextInput className="form-control search col-md-12" type="text" name="spotiquSearch" value={this.state.search.q} onTextChange={this.handleChangeEvent} placeholder="Search" />
                <View className={(this.state.search.q ? "visible" : "invisible") + " clearSearch"} onPress={this.clearSearch}>
                    <Text style={{ fontFamily: "fas", fontSize: 20 }}>{icon["times-circle"]}</Text>
                </View>
                <View style={styles.searchResults}>
                    {this.renderPlaylists()}
                    {this.renderArtists()}
                    {this.hasMoreResults() ?
                        <Text className="showMore" onPress={this.showMoreArtists}>Show more</Text> :
                        null
                    }
                    {this.renderAlbums()}
                    {this.hasMoreResults() ?
                        <Text className="showMore" onPress={this.showMoreAlbums}>Show more</Text> :
                        null
                    }
                    {this.renderTracks()}
                    {this.hasMoreResults() ?
                        <Text className="showMore" onPress={this.showMoreTracks}>Show more</Text> :
                        null
                    }
                </View>
            </View>
        );
    }

    hasMoreResults() {
        return this.state.artists.length > 4 && this.state.search.limit < 50 && this.state.search.q;
    }
}

export default SearchForm;
