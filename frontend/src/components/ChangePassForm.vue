<script setup lang="ts">
import { ref, type Ref } from 'vue'

const changePasswordAskRoute = import.meta.env
    .VITE_CHANGE_PASSWORD_ASK_ROUTE as string

const passwordInput: Ref<string> = ref('')
const errMessage: Ref<string> = ref('')
const resSuccessful: Ref<string> = ref('')

defineProps({
    emailFromCache: String,
})

const handleSubmit = async (passwordInput: string): Promise<void> => {
    const data = {
        loginPassword: passwordInput,
    }
    const res = await fetch(changePasswordAskRoute, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
    })
    const jsonRes = await res.json()
    if (res.ok) {
        resSuccessful.value = jsonRes.message
    } else {
        errMessage.value = jsonRes.message
    }
}
// TODO: Change password field to be empty after submit
</script>

<template>
    <div>
        <p>You're about to change the password for {{ emailFromCache }}</p>
        <span className="password-form">
            <label className="password-label" for="password">
                Enter Your Password:
            </label>
            <input
                type="password"
                id="password"
                className="password-input"
                size="30"
                minlength="10"
                placeholder="Password1234!"
                v-model="passwordInput"
                v-focus
                @keyup.enter="handleSubmit(passwordInput as string)"
                required
            />
            <!-- TODO: Integrate zod here to validate if is email and if password passes 
                specific params (i.e. length, special characters, numbers, 
                capitalized letters, etc.) (see backend for reference) -->
            <!-- TODO: Setup a vue watcher to tell if email/password are valid 
                and notify user if they are/aren't -->
            <button
                @click="handleSubmit(passwordInput as string)"
                type="submit"
                value="Submit"
                className="submit-btn"
            >
                Submit
            </button>
        </span>
        <button className="btn" @click="$emit('goBack')">Go Back</button>
        <span v-if="errMessage">
            <p>{{ errMessage }}</p>
        </span>
        <span v-else-if="resSuccessful.length">
            <p>{{ resSuccessful }}</p>
        </span>
        <span v-else />
    </div>
</template>

<style scoped>
.password-input {
    display: flex;
    text-align: center;
    font-weight: 700;
    font-size: 80%;
    margin: 1em auto -1em auto;
    border: 2px solid black;
    padding: 0.5em;
    border-radius: 5px;
}
.btn {
    cursor: pointer;
    padding: 0.5em;
    font-weight: 700;
    font-size: 80%;
    border: 2px solid black;
    border-radius: 5px;
    margin: 0.5em auto;
}
.submit-btn {
    display: flex;
    margin: 3em auto 1em auto;
    cursor: pointer;
    padding: 0.5em;
    font-weight: 700;
    font-size: 80%;
    border: 2px solid black;
    border-radius: 5px;
}
</style>
