# conversation-backup

## Instructions

- Get a copy of the tool from [here](https://github.com/circuit/conversation-backup/releases) and extract it to your PC.
- Install Chrome Extension "EditThisCookie" from [here](https://chrome.google.com/webstore/detail/editthiscookie/fngmhnnpilhplaeedifhccceomclgfbg) and pin it to the extension bar.
<img src="https://user-images.githubusercontent.com/684766/161038923-a221f2d0-8477-4afb-ac94-b70de5610783.png" width="200">

- Log into your Circuit account via Chrome web browser and get the value of connect.sess via the Chrome extension "EditThisCookie".
<img src="https://user-images.githubusercontent.com/684766/161039962-db50dee3-9d12-4fff-bc03-e201e1f7bf59.png" width="200">

- In the extracted folder, open config.txt file and set your Circuit login server address and paste the connect.sess value into the file.
    - possible server addresses are: eu.yourcircuit.com, na.yourcircuit.com, beta.circuit.com

- Run the tool by drag&drop the file _run.js_ onto _node.exe_ (or by executing via cmd "node.exe run.js"). In the first step an overview of all your conversations will be created and is available in a CSV file in the same folder.
<img src="https://user-images.githubusercontent.com/684766/161041336-0f94d010-bc77-4491-b0cc-985fb3ec2738.png" width="200">

- Open the CSV file and delete all lines of conversations that you do not want to save. Keep in mind to not select too many at once, it may take a long time.
- Run the tool again as described above. This time, a full backup of your selected conversations is created and will be available in the folder named **output**.
<img src="https://user-images.githubusercontent.com/684766/161041757-fec06c18-da62-44c9-bced-a33bf1eb9896.png" width="200">
