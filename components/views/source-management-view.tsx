"use client"

import type React from "react"
import { useState, useEffect } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  DialogActions,
  IconButton,
} from "@mui/material"
import { Delete as DeleteIcon, Edit as EditIcon } from "@mui/icons-material"
import { feedService } from "@/lib/services/feed-service"
import { useAuth } from "@/components/auth/auth-provider"

interface Feed {
  id: string
  name: string
  url: string
}

const SourceManagementView: React.FC = () => {
  const [feeds, setFeeds] = useState<Feed[]>([])
  const [open, setOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [selectedFeed, setSelectedFeed] = useState<Feed | null>(null)
  const [name, setName] = useState("")
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)

  const { user } = useAuth()

  useEffect(() => {
    if (user) {
      loadFeeds()
    }
  }, [user])

  const loadFeeds = async () => {
    try {
      setLoading(true)
      const feeds = await feedService.getUserFeeds(user!.id)
      setFeeds(feeds)
    } catch (error) {
      console.error("Error loading feeds:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddFeed = async (feedData: any) => {
    try {
      await feedService.addFeed(user!.id, feedData)
      await loadFeeds()
    } catch (error) {
      console.error("Error adding feed:", error)
    }
  }

  const handleUpdateFeed = async (feedId: string, feedData: any) => {
    try {
      await feedService.updateFeed(user!.id, feedId, feedData)
      await loadFeeds()
    } catch (error) {
      console.error("Error updating feed:", error)
    }
  }

  const handleDeleteFeed = async (feedId: string) => {
    try {
      await feedService.deleteFeed(user!.id, feedId)
      await loadFeeds()
    } catch (error) {
      console.error("Error deleting feed:", error)
    }
  }

  const handleClickOpen = () => {
    setOpen(true)
  }

  const handleClose = () => {
    setOpen(false)
    setName("")
    setUrl("")
  }

  const handleEditClickOpen = (feed: Feed) => {
    setSelectedFeed(feed)
    setName(feed.name)
    setUrl(feed.url)
    setEditOpen(true)
  }

  const handleEditClose = () => {
    setEditOpen(false)
    setSelectedFeed(null)
    setName("")
    setUrl("")
  }

  const handleAdd = async () => {
    if (name && url) {
      await handleAddFeed({ name, url })
      handleClose()
    }
  }

  const handleUpdate = async () => {
    if (selectedFeed && name && url) {
      await handleUpdateFeed(selectedFeed.id, { name, url })
      handleEditClose()
    }
  }

  const handleDelete = async (id: string) => {
    await handleDeleteFeed(id)
  }

  return (
    <div>
      <Button variant="contained" color="primary" onClick={handleClickOpen}>
        Add Source
      </Button>

      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }} aria-label="simple table">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>URL</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell align="center" colSpan={3}>
                  Loading...
                </TableCell>
              </TableRow>
            ) : (
              feeds.map((feed) => (
                <TableRow key={feed.id} sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
                  <TableCell component="th" scope="row">
                    {feed.name}
                  </TableCell>
                  <TableCell>{feed.url}</TableCell>
                  <TableCell align="right">
                    <IconButton aria-label="edit" onClick={() => handleEditClickOpen(feed)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton aria-label="delete" onClick={() => handleDelete(feed.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>Add New Source</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            id="name"
            label="Name"
            type="text"
            fullWidth
            variant="standard"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <TextField
            margin="dense"
            id="url"
            label="URL"
            type="url"
            fullWidth
            variant="standard"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleAdd}>Add</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editOpen} onClose={handleEditClose}>
        <DialogTitle>Edit Source</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            id="name"
            label="Name"
            type="text"
            fullWidth
            variant="standard"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <TextField
            margin="dense"
            id="url"
            label="URL"
            type="url"
            fullWidth
            variant="standard"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEditClose}>Cancel</Button>
          <Button onClick={handleUpdate}>Update</Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}

export default SourceManagementView
