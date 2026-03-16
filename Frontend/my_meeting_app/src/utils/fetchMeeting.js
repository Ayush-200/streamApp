const fetchMeetings = async(emailId) => {
    const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/getUserMeetings/${emailId}`);
    const data = await response.json();
    console.log("data ")
    console.log(data);
    const combined = (data.meeting || []).map((m, i) =>({
        meeting: m, 
        date: data.date[i]
    }))

    // console.log(combined);
    combined.sort((a, b) => a.date - b.date);

    // Get only the top 4
    const topFour = combined.slice(0, 4);

    return topFour;

};

export default fetchMeetings;