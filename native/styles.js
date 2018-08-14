import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
    loading: {
      color: "#FFF"
    },
    text: {
      fontFamily: "Montserrat",
      color: "#FFF"
    },
    error: {
      fontFamily: "Montserrat",
      color: "#FF0000"
    },
    loginContainer: {
      backgroundColor: "#393939",
      flex: 1,
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center"
    },
    btn: {
      borderRadius: 20,
      overflow: "hidden"
    },
    searchContainer: {
        backgroundColor: "#393939"
    },
    visible: {
        display: "flex"
    },
    show: {
        display: "none"
    },
    hide: {
        display: "none"
    },
    hidden: {
        display: "flex"
    }
});

export default styles;