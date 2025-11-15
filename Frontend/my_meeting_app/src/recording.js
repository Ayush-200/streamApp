let mediaRecorder;
let chunks = [];

export async function startRecording(meetingName) {
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    console.log("getUserMedia supported.");

    try {
      // Capture both video and audio
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      // Show preview (optional)
    //   document.querySelector("#preview").srcObject = stream;

      // Setup recorder
      mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9,opus",
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        chunks = [];
        console.log("onstop")

        // Save locally or upload to backend
        uploadRecording(blob, meetingName);
      };

      mediaRecorder.start(1000); // collect data every 1s
      console.log("Recording started.");
    } catch (err) {
      console.error("Error accessing camera/mic:", err);
    }
  } else {
    console.log("getUserMedia not supported!");
  }
}

export function stopRecording(meetingName) {
  mediaRecorder.stop();
  console.log("Recording stopped.");
}

function uploadRecording(blob, meetingName) {
    console.log("inside upload function");
  const formData = new FormData();
  formData.append("file", blob, `user-${Date.now()}.webm`);

  fetch(`http://localhost:3000/upload/${meetingName}`, {
    method: "POST",
    body: formData,
  }).then((res) => console.log("Uploaded:", res));
}
