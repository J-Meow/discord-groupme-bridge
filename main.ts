async function sendMessage(group: string, message: string) {
    const response = await (
        await fetch(
            "https://api.groupme.com/v3/groups/" + group + "/messages",
            {
                method: "POST",
                headers: {
                    "X-Access-Token": Deno.env.get("GROUPME_TOKEN")!,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: {
                        attachments: [],
                        text: message,
                        source_guid: crypto.randomUUID().replaceAll("-", ""),
                    },
                }),
            },
        )
    ).json()
    if (response.meta.code != 201) {
        console.log(response)
        throw new Error("Message failed to send")
    }
    return response
}

await sendMessage(Deno.env.get("BASE_GROUP")!, "Bot started")
