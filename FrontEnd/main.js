Moralis.initialize("vgXE9w1xjKC0ySGaujFZrBBhgXRBYCPZUZiJ4XeI");
Moralis.serverURL = 'https://obdg0bq48m4m.usemoralis.com:2053/server';
const TOKEN_CONTRACT_ADDRESS = "0x1B5A46fB6f0589b48184a1788Fc35d7E920fCEA9";
const MARKETPLACE_CONTRACT_ADDRESS = "0xD09eEd06f09db762F181f37d354c4B6debf9fd31";

init = async () => {
    closeUserInfo();
    hideElement(userItemsSection);
    hideElement(createItemForm);
    hideElement(userInfo);

    window.web3 = await Moralis.Web3.enable();
    window.tokenContract = new web3.eth.Contract(tokenContractAbi, TOKEN_CONTRACT_ADDRESS);
    window.marketplaceContract = new web3.eth.Contract(marketplaceContractAbi, MARKETPLACE_CONTRACT_ADDRESS);
    initUser();
    loadItems();

    const soldItemsQuery = new Moralis.Query('SoldItems');
    const soldItemsSubscription = await soldItemsQuery.subscribe();
    soldItemsSubscription.on("create", onItemSold);

    const itemsAddedQuery = new Moralis.Query('ItemsForSale');
    const itemsAddedSubscription = await itemsAddedQuery.subscribe();
    itemsAddedSubscription.on("create", onItemAdded);
};


onItemSold = async (item) => {
    const listing = document.getElementById(`item-${item.attributes.uid}`);
    if (listing){
        listing.parentNode.removeChild(listing);
    }
    
    user = await Moralis.User.current();
    if (user){
        const params = {uid: `${item.attributes.uid}`};
        const soldItem = await Moralis.Cloud.run('getItem', params);
        if (soldItem){
            if (user.get('accounts').includes(item.attributes.buyer)){
                getAndRenderItemData(soldItem, renderUserItem);
            }

            const userItemListing = document.getElementById(`user-item-${item.tokenObjectId}`);
            if (userItemListing) userItemListing.parentNode.removeChild(userItemListing);
          
        }
   
    }
}

onItemAdded = async (item) => {
    const params = {uid: `${item.attributes.uid}`};
    const addedItem = await Moralis.Cloud.run('getItem', params);
    if (addedItem){
        user = await Moralis.User.current();
        if (user){
            if (user.get('accounts').includes(addedItem.ownerOf)){
                const userItemListing = document.getElementById(`user-item-${item.tokenObjectId}`);
                if (userItemListing) userItemListing.parentNode.removeChild(userItemListing);
                getAndRenderItemData(addedItem, renderUserItem);
                return;
            }
        }
        getAndRenderItemData(addedItem, renderItem);
    }

}

user = null;
initUser = async () => {
    user = await Moralis.User.current();
    if (user) {
        hideElement(userConnectButton);
        showElement(userLogoutButton);
        showElement(userProfileButton);
        showElement(openCreateItemBtn);
        showElement(openUserItemsButton);
        loadUserItems();
    } else {
        showElement(userConnectButton);
        hideElement(userLogoutButton);
        hideElement(userProfileButton);
        hideElement(openCreateItemBtn);
        hideElement(openUserItemsButton);
    }
};

login = async () => {
    try {
        await Moralis.Web3.authenticate();

        initUser();
    } catch (error) {
        alert(error);
    }
};

logout = async () => {
    await Moralis.User.logOut();

    closeUserInfo();
    initUser();
};

openUserInfo = async () => {
    if (user) {
        const email = user.get("email");
        if (email) {
            userEmailField.value = email;
        } else {
            userEmailField.value = "";
        }
        userNameField.value = user.get("username");

        const avatar = user.get("avatar");
        if (avatar) {
            userAvatarImage.src = avatar.url();
            showElement(userAvatarImage);
        } else {
            hideElement(userAvatarImage);
        }
        showElement(userInfo);
    } else {
        login();
    }
};

closeUserInfo = async () => {
    hideElement(userInfo);
};

saveUserInfo = async () => {
    user.set("email", userEmailField.value);
    user.set("username", userNameField.value);

    if (userAvatarFile.files.length > 0) {
        const avatar = new Moralis.File("avatar.jpg", userAvatarFile.files[0]);

        user.set("avatar", avatar);
    }

    await user.save();
    alert("User info succesfully saved!");

    openUserInfo();
};

// openCreateItem = async () => {
//     showElement(createItemForm);
// };

closeCreateItem = async () => {
    hideElement(createItemForm);
};



createItem = async () => {
    if(createItemFile.files.length == 0){
        alert("Please select a file!");
        return;
    } else if (createItemNameField.value.length == 0){
        alert("Please name the item!");
        return;
    }

    const nftFile = new Moralis.File("nftFile.jpg", createItemFile.files[0]);
    await nftFile.saveIPFS();

    const nftFilePath = nftFile.ipfs();

    const metadata = {
        name: createItemNameField.value,
        description: createItemDescriptionField.value,
        image: nftFilePath
    };

    const nftFileMetadataFile = new Moralis.File("metadata.json", {base64 : btoa(JSON.stringify(metadata))});
    await nftFileMetadataFile.saveIPFS();

    const nftFileMetaDataFilePath = nftFileMetadataFile.ipfs();
    // const nftFileMetaDataFileHash = nftFileMetadataFile.hash();

    const nftId = await mintNft(nftFileMetaDataFilePath);

    // const Item = Moralis.Object.extend("Item");
    // const item = new Item();
    // item.set('name',createItemNameField.value);
    // item.set('description',createItemDescriptionField.value);
    // item.set('nftFilePath',nftFilePath);
    // item.set('metadataFilePath',nftFileMetaDataFilePath);
    // item.set('nftfileMetadataFileHash',nftFileMetaDataFileHash);
    // item.set('nftId', nftId);
    // item.set('nftContractAddress',TOKEN_CONTRACT_ADDRESS);
    // await item.save();
    // console.log(item);

    user = await Moralis.User.current();
    const userAddress = user.get('ethAddress');

    switch(createItemStatusField.value){
        case "0": 
            return;
        case "1": 
            await ensureMarketplaceIsApproved(nftId, TOKEN_CONTRACT_ADDRESS);
            await marketplaceContract.methods.addItemToMarket(nftId, TOKEN_CONTRACT_ADDRESS, createItemPriceField.value).send({from: userAddress});
            break;
        case "2":
            alert("Not yet supported!");
            return;
    }   
};

mintNft = async (metadataUrl) => {
    const receipt = await tokenContract.methods.createItem(metadataUrl).send({from: ethereum.selectedAddress});
    console.log(receipt);
    return receipt.events.Transfer.returnValues.tokenId;
};

openUserItems = async () => {
    user = await Moralis.User.current();
    if (user){
        showElement(userItemsSection);
    } else {
        login();
    }
};

loadUserItems = async () => {
    const ownedItems = await Moralis.Cloud.run("getUserItems");
    ownedItems.forEach(item => {
        const userItemListing = document.getElementById(`user-item-${item.tokenObjectId}`);
        if(userItemListing) return;
        getAndRenderItemData(item, renderUserItem);
    });
};

loadItems = async () => {
    const items = await Moralis.Cloud.run("getItems");
    user = await Moralis.User.current();
    items.forEach(item => {
        if (user){
            if (user.attributes.accounts.includes(item.ownerOf)){
                const userItemListing = document.getElementById(`user-item-${item.tokenObjectId}`);
                if(userItemListing) userItemListing.parentNode.removeChild(userItemListing);
                getAndRenderItemData(item, renderUserItem);
                return;
            }
        }
        getAndRenderItemData(item, renderItem);
    });
};

initTemplate = (id) => {
    const template = document.getElementById(id);  //gets reference to the div existing in the html
    template.id = ""; //sets it to nothing
    template.parentNode.removeChild(template); //"removes" child of template, I guess? But div is still available as reference!!
    return template;
};

renderUserItem = async (item) => {
    const userItemListing = document.getElementById(`user-item-${item.tokenObjectId}`);
    if (userItemListing) return;

    const userItem = userItemTemplate.cloneNode(true);
    userItem.getElementsByTagName("img")[0].src = item.image;
    userItem.getElementsByTagName("img")[0].alt = item.name;
    userItem.getElementsByTagName("h5")[0].innerText = item.name;
    userItem.getElementsByTagName("p")[0].innerText = item.description;
    userItem.id = `user-item-${item.tokenObjectId}`;

    userItem.getElementsByTagName("input")[0].value = item.askingPrice ?? 1;
    userItem.getElementsByTagName("input")[0].disabled = item.askingPrice > 0;
    userItem.getElementsByTagName("button")[0].disabled = item.askingPrice > 0;
    userItem.getElementsByTagName("button")[0].onclick = async () => {
        user = await Moralis.User.current();
        if(!user){
            login();
            return;
        }
        await ensureMarketplaceIsApproved(item.tokenId, item.tokenAddress);
        await marketplaceContract.methods.addItemToMarket(item.tokenId, item.tokenAddress, userItem.getElementsByTagName("input")[0].value).send({from: user.get('ethAddress')});
        
    }

    userItem.id = `user-item${item.tokenObjectId}`;
    userItems.appendChild(userItem);

};


renderItem = async (item) => {
    const itemForSale = marketplaceItemTemplate.cloneNode(true);
    if(item.avatar){
        itemForSale.getElementsByTagName("img")[0].src = item.sellerAvatar.url();
        itemForSale.getElementsByTagName("img")[0].alt = item.sellerUsername;
    }
    itemForSale.getElementsByTagName("img")[1].src = item.image;
    itemForSale.getElementsByTagName("img")[1].alt = item.name;
    itemForSale.getElementsByTagName("h5")[0].innerText = item.name;
    itemForSale.getElementsByTagName("p")[0].innerText = item.description;
    itemForSale.getElementsByTagName("button")[0].innerText = `Buy for ${item.askingPrice}`;
    itemForSale.getElementsByTagName("button")[0].onclick = () => buyItem(item);
    
    // userItem.getElementsByTagName("input")[0].value = item.askingPrice ?? 1;
    // userItem.getElementsByTagName("input")[0].disabled = item.askingPrice > 0;
    // userItem.getElementsByTagName("button")[0].disabled = item.askingPrice > 0;
    // userItem.getElementsByTagName("button")[0].onclick = async () => {
    //     user = await Moralis.User.current();
    //     if(!user){
    //         login();
    //         return;
    //     }
    //     await ensureMarketplaceIsApproved(item.tokenId, item.tokenAddress);
    //     await marketplaceContract.methods.addItemToMarket(item.tokenId, item.tokenAddress, userItem.getElementsByTagName("input")[0].value).send({from: user.get('ethAddress')});
        
    // }

    itemForSale.id = `item-${item.uid}`;
    itemsForSale.appendChild(itemForSale);
    console.log(item)

};

getAndRenderItemData = (item, renderFunction) => {
    fetch(item.tokenuri)
    .then(response => response.json())
    .then(data => {
        item.name = data.name;
        item.description = data.description;
        item.image = data.image;
        renderFunction(item);        
    })

};

ensureMarketplaceIsApproved = async (tokenId, tokenAddress) => {
    user = await Moralis.User.current();
    const userAddress = user.get('ethAddress');
    const contract = new web3.eth.Contract(tokenContractAbi, tokenAddress);
    const approvedAddress = await contract.methods.getApproved(tokenId).call({from: userAddress});
    if(approvedAddress != MARKETPLACE_CONTRACT_ADDRESS){
        await contract.methods.approve(MARKETPLACE_CONTRACT_ADDRESS, tokenId).send({from: userAddress});
    }

};

buyItem = async (item) => {
    user = await Moralis.User.current();
    if (!user){
        login();
        return;
    } 
    await marketplaceContract.methods.buyItem(item.uid).send({from: user.get('ethAddress'), value: item.askingPrice});
};

hideElement = (element) => (element.style.display = "none");
showElement = (element) => (element.style.display = "block");

const userConnectButton = document.getElementById("btnConnect");
userConnectButton.onclick = login;

const userLogoutButton = document.getElementById("btnLogout");
userLogoutButton.onclick = logout;

const userProfileButton = document.getElementById("btnUserInfo");
userProfileButton.onclick = openUserInfo;

const userSaveUserInfoButton = document.getElementById("btnSaveUserInfo");
userSaveUserInfoButton.onclick = saveUserInfo;

const userCloseUserInfoButton = document.getElementById("btnCloseUserInfo");
userCloseUserInfoButton.onclick = closeUserInfo;

const userInfo = document.getElementById("userInfo");
const userNameField = document.getElementById("txtUsername");
const userEmailField = document.getElementById("txtEmail");
const userAvatarImage = document.getElementById("imgAvatar");
const userAvatarFile = document.getElementById("fileAvatar");

const createItemForm = document.getElementById("createItem");
const createItemNameField = document.getElementById("textCreateItemName");
const createItemDescriptionField = document.getElementById("textCreateItemDescription");
const createItemPriceField = document.getElementById("numberCreateItemPrice");
const createItemStatusField = document.getElementById("selectCreateItemStatus");
const createItemFile = document.getElementById("fileCreateItemFile");

const openCreateItemBtn = document.getElementById("btnOpenCreateItem");
openCreateItemBtn.onclick = () => showElement(createItemForm);

const closeCreateItemBtn = document.getElementById("btnCloseCreateItem");
closeCreateItemBtn.onclick = closeCreateItem;

document.getElementById("btnCreateItem").onclick = createItem;


const userItemsSection = document.getElementById("userItems");
const userItems = document.getElementById("userItemsList");
document.getElementById("btnCloseUserItems").onclick = () => hideElement(userItemsSection);
const openUserItemsButton = document.getElementById("btnMyItems");
openUserItemsButton.onclick = openUserItems;

const userItemTemplate = initTemplate("itemTemplate");
const marketplaceItemTemplate = initTemplate("marketplaceItemTemplate");

const itemsForSale = document.getElementById("itemsForSale");

init();
