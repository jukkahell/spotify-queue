import * as React from "react";

export interface IAlbumProps {
    name: string;
    artist: string;
    id: string;
    onAlbumSelected: (id: string) => void;
}

export class Album extends React.Component<IAlbumProps> {

    public constructor(props: IAlbumProps) {
        super(props);

        this.selectAlbum = this.selectAlbum.bind(this);
    }

    protected selectAlbum(event: React.MouseEvent<HTMLElement>) {
        this.props.onAlbumSelected(event.currentTarget.id);
    }

    public render() {
        const {
            name,
            artist,
            id
        } = this.props;

        return (
            <div>
                <a onClick={this.selectAlbum} href={"#album:" + id} id={id}>{artist} - {name}</a>
            </div>
        );
    }
}

export default Album;
