import * as React from "react";

export interface IAlbumProps {
    name: string;
    artist: string;
    id: string;
}

export class Album extends React.Component<IAlbumProps> {

    public constructor(props: IAlbumProps) {
        super(props);
    }

    public render() {
        const {
            name,
            artist,
            id
        } = this.props;

        return (
            <div>
                <a href={"#album:" + id} id={id}>{artist} - {name}</a>
            </div>
        );
    }
}

export default Album;
