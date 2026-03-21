const fetchMeetings = async(emailId) => {
    const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/getUserMeetings/${emailId}`);
    const data = await response.json();
    console.log("data ")
    console.log(data);
    const combined = (data.meeting || []).map((m, i) =>({
        meeting: m, 
        date: data.date[i]
    }))

    // Sort by date (oldest first)
    combined.sort((a, b) => a.date - b.date);

    return combined;

};

export default fetchMeetings;