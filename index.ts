import * as fs from 'fs'
import * as path from 'path'

/**
 * Recursively reads files from the specified directory and its target subdirectories.
 * It reads the main "app.ts" file from the root "src" directory and any file found in
 * directories listed in the targetDirs array.
 *
 * @param {string} dir - The directory to scan.
 * @param {string[]} targetDirs - An array of directory names that should be scanned for files.
 * @param {{ [key: string]: string }} [fileContents={}] - An accumulator object mapping file paths to their contents.
 * @returns {{ [key: string]: string }} An object containing file paths as keys and their respective contents as values.
 */
const readFilesRecursively = (dir: string, targetDirs: string[], fileContents: { [key: string]: string } = {}): { [key: string]: string } => {
	console.log(`Scanning directory: ${dir}`)
	const entries = fs.readdirSync(dir, { withFileTypes: true })

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name)
		// If the entry is a directory and is one of the target directories, recurse into it.
		if (entry.isDirectory() && targetDirs.includes(entry.name)) {
			console.log(`Entering target directory: ${fullPath}`)
			readFilesRecursively(fullPath, targetDirs, fileContents)
		}
		// If the entry is the "app.ts" file in the root "src" directory, read its content.
		else if (entry.isFile() && entry.name === 'app.ts' && dir === path.join(__dirname, 'src')) {
			console.log(`Reading main app file: ${fullPath}`)
			const content = fs.readFileSync(fullPath, 'utf-8')
			fileContents[fullPath] = content
		}
		// If the entry is a file and its path includes one of the target directory names, read it.
		else if (entry.isFile() && targetDirs.some((d) => fullPath.includes(d))) {
			console.log(`Reading file: ${fullPath}`)
			const content = fs.readFileSync(fullPath, 'utf-8')
			fileContents[fullPath] = content
		}
	}

	return fileContents
}

/**
 * Sends a prompt to the OpenAI API and retrieves the generated response.
 *
 * @param {string} prompt - The prompt text to send to the OpenAI API.
 * @param {string} openaiApiKey - The API key for authenticating with OpenAI.
 * @returns {Promise<string>} A promise that resolves to the response content generated by OpenAI.
 */
const sendToOpenAI = async (prompt: string, openaiApiKey: string): Promise<string> => {
	const apiUrl = 'https://api.openai.com/v1/chat/completions'

	const headers = {
		'Content-Type': 'application/json',
		Authorization: `Bearer ${openaiApiKey}`
	}

	const data = {
		model: 'gpt-3.5-turbo',
		messages: [{ role: 'user', content: prompt }]
	}

	try {
		console.log('Sending request to OpenAI API...')
		const response = await fetch(apiUrl, {
			method: 'POST',
			headers: headers,
			body: JSON.stringify(data)
		})

		if (!response.ok) {
			throw new Error(`HTTP error! Status: ${response.status}`)
		}

		const responseData = await response.json()
		// @ts-ignore
		const completion = responseData.choices[0].message.content
		console.log('Received response from OpenAI API.')
		return completion
	} catch (error) {
		console.error('Error communicating with OpenAI API:', error)
		throw error
	}
}

/**
 * Generates a Postman collection JSON file by:
 *  1. Recursively reading relevant project source files.
 *  2. Combining the contents of these files into a single prompt.
 *  3. Sending the prompt to the OpenAI API to generate a Postman collection.
 *  4. Saving the generated JSON to the specified output file.
 *
 * @param {Object} params - The parameters for generating the Postman collection.
 * @param {string[]} params.sourceDirectories - Array of directory names to target for reading files taking into account that this function is being run from the root directory.
 * @param {string} params.openaiApiKey - OpenAI API key used for authenticating the request.
 * @param {string} params.outputFilePath - The file path where the generated Postman collection JSON will be saved.
 */
const generatePostmanCollection = async ({ sourceDirectories, openaiApiKey, outputFilePath }: { sourceDirectories: string[]; openaiApiKey: string; outputFilePath: string }) => {
	console.log('Starting Postman collection generation...')

	// Define the root source directory.
	const srcDir = path.join(__dirname, 'src')
	console.log(`Source directory set to: ${srcDir}`)

	// Set the target directories.
	const targetDirs = sourceDirectories
	console.log(`Target directories: ${targetDirs.join(', ')}`)

	// Read all relevant files from the project.
	console.log('Reading files from project...')
	const allFileContents = readFilesRecursively(srcDir, targetDirs)
	console.log(`Total files read: ${Object.keys(allFileContents).length}`)

	// Combine all file contents into a single string for the prompt.
	const combinedContents = Object.values(allFileContents).join('\n\n')
	console.log('Combined file contents for prompt prepared.')

	// Define the prompt with instructions for generating a Postman collection.
	const prompt = `Here is the combined content of my project files:\n\n${combinedContents}\n\nPROMPT: Create a JSON file that can be imported as a Postman collection. Organize the requests into folders and subfolders that reflect the structure of the project, grouping related endpoints together. Ensure that for each API endpoint, the generated Postman collection includes:
	- The correct HTTP method.
	- The full URL, utilizing the 'base_url' variable (which includes the protocol, e.g., 'https://api.example.com').
	- Appropriate headers, including 'Content-Type' set to 'application/json' where applicable.
	- The complete request body for endpoints that require one, based on the provided project files.
	Only return the JSON required for the Postman collection.
	- Don't include protocol in the url object.
	- The admin routes have a different variable named 'admin_key' instead of 'jwt_token'.
	- Include request bodies for POST, PATCH and PUT requests also.
	`

	console.log('Sending prompt to OpenAI to generate Postman collection...')
	// Send the prompt to OpenAI and receive the generated Postman collection JSON.
	const openAIResponse = await sendToOpenAI(prompt, openaiApiKey)

	// Determine the absolute output path.
	const outputPath = path.join(__dirname, outputFilePath)
	console.log(`Writing generated Postman collection to file: ${outputPath}`)

	// Save the generated JSON to the specified file.
	fs.writeFileSync(outputPath, openAIResponse, 'utf-8')

	console.log(`Postman collection JSON has been saved successfully to ${outputPath}`)
}

export { generatePostmanCollection }
