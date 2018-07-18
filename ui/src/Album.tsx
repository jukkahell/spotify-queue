import * as React from "react";

export interface IAlbumProps {
    name: string;
    artist: string;
    id: string;
    artistId: string;
}

export class Album extends React.Component<IAlbumProps> {

    public constructor(props: IAlbumProps) {
        super(props);
    }

    public render() {
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
