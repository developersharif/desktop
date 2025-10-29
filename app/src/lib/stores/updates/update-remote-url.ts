import { IAPIRepository } from '../../api'
import { GitStore } from '../git-store'
import { urlMatchesRemote } from '../../repository-matching'
import { GitHubRepository } from '../../../models/github-repository'
import { parseRemote } from '../../remote-parsing'

export async function updateRemoteUrl(
  gitStore: GitStore,
  gitHubRepository: GitHubRepository,
  apiRepo: IAPIRepository
): Promise<void> {
  // I'm not sure when these early exit conditions would be met. But when they are
  // we don't have enough information to continue so exit early!
  if (gitStore.defaultRemote === null) {
    return
  }

  const remoteUrl = gitStore.defaultRemote.url
  const updatedRemoteUrl = apiRepo.clone_url
  const urlsMatch = urlMatchesRemote(updatedRemoteUrl, gitStore.defaultRemote)

  // If the URLs already match, no need to update anything
  if (urlsMatch) {
    return
  }

  // Parse both the current remote URL and the API-provided clone URL
  // to detect if the repository has been renamed
  const parsedRemoteUrl = parseRemote(remoteUrl)
  const parsedUpdatedRemoteUrl = parseRemote(updatedRemoteUrl)

  // Check if the repository has been renamed (owner or name has changed)
  // while keeping the same hostname
  let repositoryRenamed = false
  if (parsedRemoteUrl !== null && parsedUpdatedRemoteUrl !== null) {
    const sameHost =
      parsedRemoteUrl.hostname.toLowerCase() ===
      parsedUpdatedRemoteUrl.hostname.toLowerCase()
    const ownerChanged = parsedRemoteUrl.owner !== parsedUpdatedRemoteUrl.owner
    const nameChanged = parsedRemoteUrl.name !== parsedUpdatedRemoteUrl.name

    repositoryRenamed = sameHost && (ownerChanged || nameChanged)
  }

  // Determine if the protocols match by examining the parsed URLs
  // If either parseRemote returns null (e.g., for SSH URLs), we consider them compatible
  const protocolsMatch =
    parsedRemoteUrl === null ||
    parsedUpdatedRemoteUrl === null ||
    parsedRemoteUrl.protocol === parsedUpdatedRemoteUrl.protocol

  // Check if the default remote url has been manually changed from the
  // clone url retrieved from the GitHub API previously
  const remoteUrlUnchanged =
    gitStore.defaultRemote &&
    urlMatchesRemote(gitHubRepository.cloneURL, gitStore.defaultRemote)

  // Update the remote URL if:
  // 1. The repository has been renamed on GitHub (detected above), OR
  // 2. The original conditions are met: protocols match, remote URL was
  //    unchanged from the previous cloneURL, and URLs don't match
  if (repositoryRenamed && parsedRemoteUrl !== null && parsedUpdatedRemoteUrl !== null) {
    log.info(
      `[updateRemoteUrl] Repository appears to have been renamed from ` +
        `${parsedRemoteUrl.owner}/${parsedRemoteUrl.name} to ` +
        `${parsedUpdatedRemoteUrl.owner}/${parsedUpdatedRemoteUrl.name}. ` +
        `Updating remote URL from ${remoteUrl} to ${updatedRemoteUrl}`
    )
    await gitStore.setRemoteURL(gitStore.defaultRemote.name, updatedRemoteUrl)
  } else if (protocolsMatch && remoteUrlUnchanged && !urlsMatch) {
    log.info(
      `[updateRemoteUrl] Updating remote URL from ${remoteUrl} to ${updatedRemoteUrl}`
    )
    await gitStore.setRemoteURL(gitStore.defaultRemote.name, updatedRemoteUrl)
  }
}
