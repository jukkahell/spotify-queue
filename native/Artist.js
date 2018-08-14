import * as React from "react";

export class Artist extends React.Component {

    constructor(props) {
        super(props);
    }

    render() {
        const {
            name,
            id
        } = this.props;

        return (
            <div>
                <a href={"#artist=" + id} id={id}>{name}</a>
            </div>
        );
    }
}

export default Artist;
