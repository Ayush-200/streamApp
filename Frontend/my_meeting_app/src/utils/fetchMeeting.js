const fetchMeetings = async(emailId, protectedGet) => {
    const response = await protectedGet(
        `${import.meta.env.VITE_BACKEND_URL}/getUserMeetings/${emailId}`
    );
    const data = await response.json();
    const combined = (data.meeting || []).map((m, i) =>({
        meeting: m, 
        date: data.date[i]
    }))

    combined.sort((a, b) => a.date - b.date);
    return combined;
};

export default fetchMeetings;