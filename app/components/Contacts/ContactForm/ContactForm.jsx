// @flow
import React from 'react'
import { noop } from 'lodash-es'

import { wallet } from 'neon-js'

import Button from '../../Button'
import TextInput from '../../Inputs/TextInput'
import DialogueBox from '../../DialogueBox'
import AddContactIcon from '../../../assets/icons/contacts-add.svg'
import WarningIcon from '../../../assets/icons/warning.svg'
import styles from './ContactForm.scss'

type Props = {
  submitLabel: string,
  formName: string,
  formAddress: string,
  mode?: string,
  contacts: Object,
  setName: Function,
  newAddress?: boolean,
  setAddress: Function,
  onSubmit: Function
}

type State = {
  nameError: string,
  addressError: string
}

export default class ContactForm extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)

    this.state = {
      nameError: '',
      addressError: ''
    }
  }

  static defaultProps = {
    submitLabel: 'Save Contact',
    name: '',
    address: '',
    setName: noop,
    setAddress: noop,
    onSubmit: noop
  }

  render() {
    const { submitLabel, formName, formAddress } = this.props
    const { nameError, addressError } = this.state

    return (
      <section className={styles.contactFormContainer}>
        <form className={styles.contactForm} onSubmit={this.handleSubmit}>
          <TextInput
            id="contactName"
            name="name"
            label="Name"
            className={styles.input}
            placeholder="Enter Contact Name..."
            value={formName}
            onChange={this.handleChangeName}
            error={nameError}
          />
          <TextInput
            id="contactAddress"
            label="Wallet Address"
            name="address"
            className={styles.input}
            placeholder="Enter Wallet Address..."
            value={formAddress}
            onChange={this.handleChangeAddress}
            error={addressError}
          />
          <div className={styles.dialogueAndButtonContainer}>
            <DialogueBox
              icon={<WarningIcon />}
              text="Please review and ensure that you have entered the address correctly to avoid loss of funds"
              className={styles.conactFormDialogue}
            />
          </div>
          <Button
            className={styles.submitButton}
            primary
            type="submit"
            disabled={this.disableButton(formName, formAddress)}
            renderIcon={AddContactIcon}
          >
            {submitLabel}
          </Button>
        </form>
      </section>
    )
  }

  componentWillMount() {
    const { newAddress, setAddress } = this.props

    if (newAddress) {
      setAddress('')
    }
  }

  disableButton = (name: string, address: string) => {
    if (name.length === 0) {
      return true
    }

    if (name.length > 100) {
      return true
    }

    if (!wallet.isAddress(address)) {
      return true
    }

    return false
  }

  validate = (name: string, address: string) => {
    const validName = this.validateName(name)
    const validAddress = this.validateAddress(address)

    return validName && validAddress
  }

  validateName = (name: string) => {
    const { contacts, mode } = this.props
    let error

    if (name.length === 0) {
      error = "Name can't be null." // eslint-disable-line
    }

    if (name.length > 100) {
      error = 'Name is too long.'
    }

    if (mode !== 'edit') {
      const nameExists = Object.keys(contacts).filter(
        (contactName: string) => contactName === name
      )

      if (nameExists.length > 0) {
        error = 'You already have an account saved with that name.'
      }
    }

    if (error) {
      this.setState({ nameError: error })
      return false
    }
    return true
  }

  validateAddress = (address: string) => {
    const { mode, contacts, formAddress } = this.props
    let error

    if (!wallet.isAddress(address)) {
      error = 'Address is not valid.'
    }

    if (mode !== 'edit') {
      const addressExists = Object.keys(contacts)
        .map(acc => contacts[acc])
        .filter(adr => adr === formAddress)

      if (addressExists.length > 0) {
        error = 'You already have a contact with that address.'
      }
    }

    if (error) {
      this.setState({ addressError: error })
      return false
    }
    return true
  }

  clearErrors = (name: string) => {
    if (name === 'name') {
      return this.setState({ nameError: '' })
    }

    if (name === 'address') {
      return this.setState({ addressError: '' })
    }
  }

  handleChangeName = (event: Object) => {
    this.clearErrors(event.target.name)
    this.props.setName(event.target.value)
  }

  handleChangeAddress = (event: Object) => {
    this.clearErrors(event.target.name)
    this.props.setAddress(event.target.value)
  }

  handleSubmit = (event: Object) => {
    event.preventDefault()
    const { onSubmit, formName, formAddress } = this.props

    const validInput = this.validate(formName, formAddress)

    if (validInput) {
      onSubmit(formName, formAddress)
    }
  }
}
