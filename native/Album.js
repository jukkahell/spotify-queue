import * as React from "react";

export class Album extends React.Component {

    constructor(props) {
        super(props);
    }

    render() {
        const {
            name,
            artist,
            artistId,
            id
        } = this.props;

        return (
            <div className="albumInfo">
                <a href={"#album=" + id} id={id}>{name}</a>
                <a href={"#artist=" + artistId} className="trackArtist" id={artistId}>{artist}</a>
            </div>
        );
    }
}

export default Album;
